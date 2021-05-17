'use strict';
// "borrowed" from Microsoft's TypeScript
export default (...args) =>
{
	const result = {};
	for (let i = 0; i < args.length; ++i)
	{
		result[result[args[i]] = i] = args[i];
	}
	return result;
};