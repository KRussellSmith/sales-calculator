'use strict';
import Event from './Event.js';
import Util from './Util.js';
import Observable from './Observable.js';
import Command from './Command.js';

const Model = (() =>
{
	const dataKey = 'bizData';
	const themeKey = `${ dataKey }-theme`;
	return {
		data: null,
		cache: [],
		load()
		{
			this.data = JSON.parse(localStorage.getItem(dataKey) ?? '{"dates": [], "CPU": "0.40"}');
		},
		save()
		{
			localStorage.setItem(dataKey, JSON.stringify(this.data));
		},
		get theme()
		{
			return localStorage.getItem(themeKey) ?? null;
		},
		set theme(theme)
		{
			localStorage.setItem(themeKey, theme);
			return theme;
		},
		getDate(date)
		{
			return this.data.dates.find(x => x.date === date) ?? null;
		},
		DataBit: (date, left, spent, sold, start, end) => ({ date, left, spent, sold, start, end }),
		average()
		{
			const getTotal = date => Util.fromPrice(date.left) + Util.fromPrice(date.spent);
			const { dates } = this.data;
			if (dates.length <= 0)
			{
				return null;
			}
			else if (dates.length === 1)
			{
				const date = dates[0];
				const made = getTotal(date);
				const sold = date.sold;
				const time = Util.calcHours(date.start, date.end);
				const profit = made - (sold * Util.fromPrice(this.data.CPU));
				return {
					made: Util.toPrice(made),
					sold: sold.toString(),
					time,
					profit: Util.toPrice(profit),
				};
			}
			const made = Math.round(
				dates.reduce((prev, curr) => prev + getTotal(curr), 0) / dates.length);
				
			const sold = Math.round(
				dates.reduce((prev, curr, i, arr) => i > 1 ? prev + parseInt(curr.sold) : parseInt(prev.sold) + parseInt(curr.sold)) / dates.length);
			
			const time = Math.round(dates.reduce((prev, curr) =>
			{
				const [ hours, minutes ] = Util.calcHours(curr.start, curr.end).split(':').map(x => parseInt(x, 10));
				return prev + minutes + hours * 60;
			}, 0) / dates.length);
			
			const profit = Math.round(
				dates.reduce((prev, curr) =>
					prev + (getTotal(curr) - (curr.sold * Util.fromPrice(this.data.CPU))), 0));
			return {
				made:   Util.toPrice(made),
				sold:   sold.toString(),
				time:   Util.minutesToTime(time),
				profit: Util.toPrice(profit),
			};
		}
	};
})();

const Commands = {
	ModDate: ({ date, left, spent, sold, start, end }) =>
	{
		const { dates } = Model.data;
		const old = Model.getDate(date);
		const index = dates.indexOf(old);
		return {
			name: () => 'date modification',
			...Command.Base(),
			act()
			{
				dates.splice(index, 1, Model.DataBit(date, left, spent, sold, start, end));
				Command.notify(Event.DATA_CHANGED);
			},
			un()
			{
				dates.splice(index, 1, old);
				Command.notify(Event.DATA_UNCHANGED);
			},
		};
	},
	AddDate: ({ date, left, spent, sold, start, end }) =>
	{
		const { dates } = Model.data;
		const index = dates.length;
		return {
			name: () => 'additional date',
			...Command.Base(),
			act()
			{
				dates.splice(index, 0, Model.DataBit(date, left, spent, sold, start, end));
				Command.notify(Event.DATA_CHANGED);
			},
			un()
			{
				dates.splice(index, 1);
				Command.notify(Event.DATA_UNCHANGED);
			},
		};
	},
	RemoveDate: (date) =>
	{
		const { dates } = Model.data;
		const day = Model.getDate(date);
		const index = dates.indexOf(day);
		return {
			name: () => 'remove date',
			...Command.Base(),
			act()
			{
				dates.splice(index, 1);
				Command.notify(Event.DATA_CHANGED);
			},
			un()
			{
				// Only wimp UI programmers say “this action cannot be undone.”
				dates.splice(index, 0, day);
				Command.notify(Event.DATA_UNCHANGED);
			},
		};
	},
	
	// Saving used to be a Command (and ergo was itself undoable),
	// I decided that the behavior was unexpected,
	// and gobbled up extra memory, so that's no longer the case.
	// The caveat here is: if you undo or redo, you must still remember to save.
	Save: () =>
	{
		return {
			...Command.Base(),
			name: () => 'save',
			act()
			{
				Model.save();
				document.querySelector`#save`.disabled = true;
			},
			un()
			{
				Model.unsave();
				document.querySelector`#save`.disabled = false;
				Command.notify(Event.UNSAVED);
			},
		};
	},
};
const Observer = (() =>
{
	let changes = 0;
	const result = {
		notify(subject, event)
		{
			switch (event)
			{
				// Startup:
				case Event.BOLDLY_GOING:
					
					if ('serviceWorker' in navigator)
					{
						navigator.serviceWorker.
							register('./worker.js').
							then(() => console.log('Service Worker Registered'));
					}
					Model.load();
					App.setupTheme();
					App.updateAverageTable(Model.average());
					document.querySelector`#curr-year`.textContent = Util.roman((new Date()).getFullYear());
					break;
				// Directly from user input:
				case Event.FORM_SUBMIT:
				{
					const command = (
							Model.getDate(document.querySelector`#date`.value) !== null ?
								Commands.ModDate : Commands.AddDate);
					Command.perform(command(subject.getFormData()));
					break;
				}
				case Event.REMOVE_DATE:
					Command.perform(Commands.RemoveDate(document.querySelector`#date`.value));
					break;
				case Event.DAY_PICKED:
					App.syncData();
				break;
				case Event.SAVE:
					Model.save();
					changes = 0;
					break;
				// From application's response to user input:
				case Event.DATA_CHANGED:
					App.syncData();
					App.updateAverageTable(Model.average());
					/*
						The Command object is ‘hot’ when its last command was performed for the first time (and not undone or redone);
						in which case, there aren't any redos to worry about, and we know the program is in an unsaved state.
						This means: `changes` cannot be negative (because there is nothing to redo), so if that's the case,
						we set it to the command's stack height (for we assume undoing will always leave us in an unsaved state[0]).
						I do not care to admit how long it took me to find this stupidly simple solution…
						
						[0] Of course, undoing might (as well as any other command action)
						    incidentally leave the program in a state _identical_ to a saved one,
						    but we don't check for the actual state of the program,
						    only the status of the Command object.
					*/
					if (!Command.hot())
					{
						changes++;
					}
					else
					{
						if (changes < 0)
						{
							changes = Command.stackHeight();
						}
						else
						{
							++changes;
						}
					}
					break;
				case Event.DATA_UNCHANGED:
					--changes;
					App.syncData();
					App.updateAverageTable(Model.average());
					break;
				case Event.COMMAND:
					document.querySelector `#undo`.disabled = !Command.canUndo();
					document.querySelector `#redo`.disabled = !Command.canRedo();
					break;
			}
			document.querySelector `#save`.disabled = changes === 0;
			
		},
	};
	return (subject, event) => result.notify(subject, event);
})();

const App = (() =>
{
	const make = (el, x) =>
	{
		el.textContent = x;
		return make;
	};
	return {
		...Observable(),
		getFormFields: () =>
		{
			const [ date, left, spent, sold, start, end, ] = [
				document.querySelector `#date`,
				document.querySelector `#left`,
				document.querySelector `#spent`,
				document.querySelector `#sold`,
				document.querySelector `#start`,
				document.querySelector `#end`, ];
			return { date, left, spent, sold, start, end };
		},
		getFormData()
		{
			const fields = this.getFormFields();
			const result = {};
			for (const key in fields)
			{
				result[key] = fields[key].value;
			}
			return result;
		},
		syncData()
		{
			const date = document.querySelector`#date`.value;
			const data = Model.getDate(date);
			const dataBtn = document.querySelector`#apply-data`;
			const table = document.querySelector`#day table`;
			
			
			const [ picked, made, sold, time, profit, ] = [
				table.querySelector`#picked`,
				table.querySelector`#day-made`,
				table.querySelector`#day-sold`,
				table.querySelector`#day-time`,
				table.querySelector`#day-profit`, ];
			if (data === null)
			{
				document.querySelector`#delete`.disabled = true;
				dataBtn.value = 'Agregar';
				const NA = 'N/A';
				
				make(
					picked, date.replace(/\-/g, '/'))(
					made,   NA)(
					sold,   NA)(
					time,   NA)(
					profit, NA);
				
				return;
			}
			dataBtn.value = 'Aplicar';
			document.querySelector `#delete`.disabled = false;
			const total = Util.fromPrice(data.left) + Util.fromPrice(data.spent);
			make(
				picked, data.date.replace(/\-/g, '/'))(
				made,   Util.toPrice(total.toString()))(
				sold,   data.sold)(
				time,   `${ Util.calcHours(data.start, data.end) }`)(
				profit, Util.toPrice(total - (parseInt(data.sold) * Util.fromPrice(Model.data.CPU))));
			const fields = this.getFormFields();
			
			fields.left.value  = data.left;
			fields.spent.value = data.spent;
			fields.sold.value  = data.sold;
			fields.start.value = data.start;
			fields.end.value   = data.end;
		},
		updateAverageTable: (data) =>
		{
			const [ made, sold, time, profit, ] = [
				document.querySelector `#avg-made`,
				document.querySelector `#avg-sold`,
				document.querySelector `#avg-time`,
				document.querySelector `#avg-profit`, ];
			if (data === null)
			{
				const NA = 'N/A';
				make(
					made,   NA)(
					sold,   NA)(
					time,   NA)(
					profit, NA);
			}
			else
			{
				make(
					made,   data.made)(
					sold,   data.sold)(
					time,   data.time)(
					profit, data.profit);
			}
		},
		setupTheme()
		{
			const toggle = document.querySelector`#mode-toggle`;
			const preference = window.matchMedia`(prefers-color-scheme: dark)`;
			const { theme } = Model;
			if (theme === 'dark')
			{
				document.body.classList.toggle`dark`;
				toggle.textContent = '☀️';
			}
			else if (theme === 'light')
			{
				document.body.classList.toggle`light`;
				toggle.textContent = '🌙';
			}
			else
			{
				document.body.classList.toggle(
					preference.matches ? 'dark' : 'light');
				toggle.textContent = preference.matches ? '☀️': '🌙';
			}
		},
		init()
		{
			this.addObserver(Observer);
			Command.addObserver(Observer);
			this.notify(Event.BOLDLY_GOING);
			
			document.querySelector`form`.onsubmit = e =>
			{
				e.preventDefault();
				this.notify(Event.FORM_SUBMIT);
			};
			document.querySelector`#date`.onchange = e => this.notify(Event.DAY_PICKED);
			document.querySelector`#delete`.onclick = e => this.notify(Event.REMOVE_DATE);
			document.querySelector`#save`.onclick   = e => this.notify(Event.SAVE);
			document.querySelector`#undo`.onclick   = e => Command.undo();
			document.querySelector`#redo`.onclick   = e => Command.redo();
			
			const toggle = document.querySelector`#mode-toggle`;
			toggle.onclick = (() =>
			{
				return e =>
				{
					document.body.classList.toggle`light`;
					document.body.classList.toggle`dark`;
					const chosen = document.body.classList.contains`light` ? 'light' : 'dark';
					Model.theme = chosen;
					toggle.textContent = chosen === 'dark' ? '☀️' : '🌙';
				};
			})();
			
		}
	};
})();

export default () => App.init();
