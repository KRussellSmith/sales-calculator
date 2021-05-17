'use strict';
import Event from './Event.js';
import Observable from './Observable.js';
export default (() =>
{
	let hot = false;
	let cp = 0;
	const stack = [];
	return {
		...Observable(),
		Base: () => ({
			act()
			{},
			un()
			{},
		}),
		reset()
		{
			cp = 0;
			stack.splice(0, stack.length);
			return this;
		},
		perform(command)
		{
			hot = true;
			stack.splice(cp, stack.length - cp);
			stack.push(command);
			command.act();
			++cp;
			this.notify(Event.COMMAND);
			return this;
		},
		undo()
		{
			hot = false;
			stack[--cp]?.un();
			this.notify(Event.COMMAND, Event.UNDO);
			return this;
		},
		redo()
		{
			hot = false;
			stack[cp++]?.act();
			this.notify(Event.COMMAND, Event.REDO);
			return this;
		},
		canUndo()
		{
			return cp > 0;
		},
		canRedo()
		{
			return cp < stack.length;
		},
		hot()
		{
			return hot;
		},
		stackHeight()
		{
			return stack.length;
		}
	};
})();