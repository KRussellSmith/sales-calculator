'use strict';
export default {
	fromPrice(x)
	{
		let price = x;
		if (!price.includes('.'))
		{
			price += '.00'
		}
		else if (price.split('.')[1].length == 1)
		{
			price += '0';
		}
		return parseInt(price.replace('.', ''));
	},
	toPrice(x)
	{
		const price = `${x}`;
		const radix = price.length - 2;
		return `${price.substring(0, radix)}.${price.substring(radix)}`;
	},
	roman(x)
	{
		// Only whole numbers may be converted:
		if (x <= 0 || x !== x | 0)
		{
			return 'NaN';
		}
		
		let num = x;
		let amount = 0;
	
		let result = '';
		while (num > 0)
		{
			if (num >= (amount = 1000))
			{
				result += 'M';
			}
			else if (num >= (amount = 900))
			{
				result += 'CM';
			}
			else if (num >= (amount = 500))
			{
				result += 'D';
			}
			else if (num >= (amount = 400))
			{
				result += 'CD';
			}
			else if (num >= (amount = 100))
			{
				result += 'C';
			}
			else if (num >= (amount = 90))
			{
				result += 'XC';
			}
			else if (num >= (amount = 50))
			{
				result += 'L';
			}
			else if (num >= (amount = 40))
			{
				result += 'XL';
			}
			else if (num >= (amount = 10))
			{
				result += 'X';
			}
			else if (num >= (amount = 9))
			{
				result += 'IX';
			}
			else if (num >= (amount = 5))
			{
				result += 'V';
			}
			else if (num >= (amount = 4))
			{
				result += 'IV'; // 'IIII' is archaic (though would make this function shorter if allowed…)
			}
			else if (num >= (amount = 1))
			{
				result += 'I';
			}
			num -= amount;
		}
		return result;
	},
	timeFormat(hours, minutes)
	{
		return `${`0${hours}`.slice(-2)}:${`0${minutes}`.slice(-2)}`;
	},
	calcHours(start, end)
	{
		const [ startH, startM ] = start.split(':');
		const [ endH,   endM ]   = end.split(':');
		let hours = (parseInt(endH) - parseInt(startH)).toString().padStart(2, '0');
		let minutes = parseInt(endM) - parseInt(startM).toString().padStart(2, '0');
		if (minutes < 0)
		{
			--hours;
			minutes += 60;
		}
		return this.timeFormat(hours, minutes);
	},
	minutesToTime(minutes)
	{
		let hours = 0;
		while (minutes >= 60)
		{
			++hours;
			minutes -= 60;
		}
		return this.timeFormat(hours, minutes);
	},
};
