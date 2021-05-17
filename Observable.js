'use strict';
export default (() =>
{
	return () =>
	{
		const dummy = x => console.log(x);
		const observers = [];
		return {
			addObserver(observer = dummy)
			{
				observers.push(observer);
			},
			removeObserver(observer = dummy)
			{
				const index = observers.indexOf(observer);
				if (index < 0)
				{
					return;
				}
				observers.splice(index, 1);
			},
			notify(...events)
			{
				for (const observer of observers)
				{
					for (const event of events)
					{
						observer(this, event);
					}
				}
			}
		}
	};
})();