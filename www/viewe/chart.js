(function () {

	var CHAR_LIMIT = 12;
	var ASCII = /^[ -~]+$/;

	var todayLabel;
	var logging = window.localStorage.getItem('logging') === 'true' ? true : false;
	var loggingBuffer = [];
	var settings;
	var scompareState = 0;
	var compareButton;
	var tday = new Date();
	var channels = [];
	var bought = 0;
	var boughtList = [];
	var sold = 0;
	var generated = 0;
	var solar = 0;
	var battery = 0;
	var last30MinUsage = 0;
	var totalUsage = 0;
	var morningTimePrice;
	var dayTimePrice;
	var nightTimePrice;
	var morningTime;
	var dayTime;
	var eveningTime;
	var nightTime;
	var kwhData = { today: null, yesterday: null };
	// default cost per kWh in JPY
	var cost = 25.8;
	// user defined kWh
	var threshold = 0;
	var thresholdRatio = 0;
	var queries = {};
	var qlist = location.search.replace('?', '').split('&');
	for (var i = 0, len = qlist.length; i < len; i++) {
		var item  = qlist[i].split('=');
		queries[item[0]] = item[1];
	}

	// day, month, year
	var range = queries.range || 'day';
	var _timeRange = -1;
	var _period = queries.period ? queries.period.split('.') : [ tday.getFullYear(), pad(tday.getMonth() + 1), pad(tday.getDate()) ];
	var _compare = null;
	var formats = {
		day: function (x) {
			return pad(x.getHours()) + ':' + pad(x.getMinutes());
		},
		month: function (x) {
			return x + '日';
		},
		year: function (x) {
			return x + '月';
		}
	};
	var types = {
		day: 'timeseries',
		month: '',
		year: ''
	};

	window.getChartRange = function () {
		return range;
	};

	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	function updateTotalDisplayLabel() {
		var elm = document.querySelector('.total-display-label');
		if (elm) {
			var label = '１日の消費電力';
			switch (range) {
				case 'month':
					label = '月間の消費電力';
					break;
				case 'year':
					label = '年間の消費電力';
					break;
			}
			elm.textContent = label;
		}
	}

	window.getRandomInt = getRandomInt;
	window.changeEasyDate = changeEasyDate;
	window.changeDate = changeDate;
	window.setEasyCompare = setEasyCompare;
	window.setCompare = setCompare;
	window.changeTime = changeTime;

	window.addEventListener('load', function () {
		if (range !== 'day') {
			var tb = document.getElementById('timeselect-block');
			if (tb) {
				tb.style.display = 'none';
			}
		}
		// we change the labels and values based on range
		setupDropdownList();
		// move it....
		var cnote = document.getElementById('content-note');
		if (cnote) {
			cnote.style.marginTop = '30px';
		}
		// set up compare button
		setupCompare();
		// set up compare battery button
		setupCompareBattery();
		// initial today
		var d = new Date();
		updateDates(d.getFullYear(), d.getMonth() + 1, d.getDate());
		// initial comparison day
		switch (range) {
			case 'year':
				d.setFullYear(d.getFullYear() - 1);
				break;
			case 'month':
				d.setMonth(d.getMonth() - 1);
				break;
			case 'day':
			default:
				d.setDate(d.getDate() - 1);
				break;
		}
		updateCompDates(d.getFullYear(), d.getMonth() + 1, d.getDate());
		// start loading graph data
		loadChannels(function () {
			// d3 chart
			var list = document.querySelectorAll('.chart');
			createCharts(list);
			// c3 chart
			list = document.querySelectorAll('.c3-chart');
			var filename = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
			if (filename === 'solar-power.html') {
				createC3Charts(list, createSolarPieChart);
			} else {
				createC3Charts(list, createPieChart);
			}
			// control range UI
			controlRangeUI();
			// update displays
			getKWHData(updateDisplays);
			// update display label
			updateTotalDisplayLabel();
		});
	}, false);

	function setupDropdownList() {
		var selects = document.querySelectorAll('select');
		if (!selects) {
			return;
		}
		for (var s = 0, sen = selects.length; s < sen; s++) {
			var select = selects[s];
			// change the labels and values...
			var opts = select.querySelectorAll('option');
			for (var i = 0, len = opts.length; i < len; i++) {
				// really sad that we have to check against Japanese texts...
				switch(opts[i].value) {
					case '今日':
						opts[i].textContent = '今日';
						opts[i].value = 'today';
						if (range === 'month') {
							opts[i].textContent = '今月';
						}
						if (range === 'year') {
							opts[i].textContent = '今年';
						}
						todayLabel = opts[i].textContent;
						break;
					case '昨日':
						if (range === 'day') {
							opts[i].textContent = '1日前';
							opts[i].value = '-1d';
						}
						if (range === 'month') {
							opts[i].textContent = '1ヶ月前';
							opts[i].value = '-1m';
						}
						if (range === 'year') {
							opts[i].textContent = '1年前';
							opts[i].value = '-1y';
						}
						break;
					case '2日前':
						if (range === 'day') {
							opts[i].textContent = '2日前';
							opts[i].value = '-2d';
						}
						if (range === 'month') {
							opts[i].textContent = '2ヶ月前';
							opts[i].value = '-2m';
						}
						if (range === 'year') {
							opts[i].textContent = '2年前';
							opts[i].value = '-2y';
						}
						break;
					case '3日前':
						if (range === 'day') {
							opts[i].textContent = '3日前';
							opts[i].value = '-3d';
						}
						if (range === 'month') {
							opts[i].textContent = '3ヶ月前';
							opts[i].value = '-3m';
						}
						if (range === 'year') {
							opts[i].textContent = '3年前';
							opts[i].value = '-3y';
						}
						break;
					case '1週間前':
						if (range === 'day') {
							opts[i].textContent = '1週間前';
							opts[i].value = '-7d';
						}
						if (range === 'month') {
							opts[i].textContent = '6ヶ月前';
							opts[i].value = '-6m';
						}
						if (range === 'year') {
							opts[i].textContent = '7年前';
							opts[i].value = '-7y';
							opts[i].parentNode.removeChild(opts[i]);
						}
						break;
					case '2週間前':
						if (range === 'day') {
							opts[i].textContent = '2週間前';
							opts[i].value = '-14d';
						}
						if (range === 'month') {
							opts[i].textContent = '9ヶ月前';
							opts[i].value = '-9m';
						}
						if (range === 'year') {
							opts[i].textContent = '14年前';
							opts[i].value = '-14y';
							opts[i].parentNode.removeChild(opts[i]);
						}
						break;
					case '3週間前':
						if (range === 'day') {
							opts[i].textContent = '3週間前';
							opts[i].value = '-21d';
						}
						if (range === 'month') {
							opts[i].textContent = '21ヶ月前';
							opts[i].value = '-21m';
							opts[i].parentNode.removeChild(opts[i]);
						}
						if (range === 'year') {
							opts[i].textContent = '21年前';
							opts[i].value = '-21y';
							opts[i].parentNode.removeChild(opts[i]);
						}
						break;
				}
			}
		}
	}

	function setupCompare() {
		// reset compare
		compareButton = document.querySelector('.switch');
		if (compareButton) {
			var btn = compareButton.querySelector('button');
			if (btn.getAttribute('data-name') === 'generated-used' || btn.getAttribute('data-name') === 'bought-sold') {
				// set up solar comaparision
				setupSolarCompare();
				return;
			}
			compareButton.addEventListener('click', function () {
				if (compareButton.enable) {
					compareButton.style.background = '#b2b4b3';
					btn.style.marginLeft = 0;
					compareButton.enable = false;
					_compare = null;
					// redraw graph
					var list = document.querySelectorAll('.c3-chart');
					createC3Charts(list);
				} else {
					btn.style.marginLeft = '20px';
					compareButton.style.background = 'rgba(251, 255, 0, 1)';
					//compareButton.style.background = '#0be679';
					compareButton.enable = true;
					// by default comapre against yesterday or last month or last year...
					var d = new Date();
					switch (range) {
						case 'year':
							d.setFullYear(d.getFullYear() - 1);
							break;
						case 'month':
							d.setMonth(d.getMonth() - 1);
							break;
						case 'day':
						default:
							d.setDate(d.getDate() - 1);
							break;
					}
					_compare = [
						d.getFullYear(),
						pad(d.getMonth() + 1),
						pad(d.getDate())
					];
					var elm = document.querySelector('div[data-source]');
					createC3Charts([elm]);
					// update compare display
					updateCompDates(_compare[0], _compare[1], _compare[2]);
				}
			});
		}
	}

	function setupSolarCompare() {
		var list = document.querySelectorAll('.switch');
		if (list[0] && list[1]) {
			var btn1 = list[0].querySelector('button');
			var btn2 = list[1].querySelector('button');
			btn1.style.marginLeft = '20px';
			//list[0].style.background = '#0be679';
			list[0].style.background = 'rgba(251, 255, 0, 1)';
			scompareState = 0;
			btn2.style.marginLeft = '0px';
			list[1].style.background = '#b2b4b3';
			btn1.addEventListener('click', function () {
				btn1.style.marginLeft = '20px';
				//list[0].style.background = '#0be679';
				list[0].style.background = 'rgba(251, 255, 0, 1)';
				scompareState = 0;
				btn2.style.marginLeft = '0px';
				list[1].style.background = '#b2b4b3';
				// redraw graph
                                createC3Charts(document.querySelectorAll('.c3-chart'));
				// for some reason the pie chart gets screwed... so redarw it here
				window.redrawPie();
			}, false);
			btn2.addEventListener('click', function () {
				btn2.style.marginLeft = '20px';
				list[1].style.background = 'rgba(251, 255, 0, 1)';
				//list[1].style.background = '#0be679';
				scompareState = 1;
				btn1.style.marginLeft = '0px';
				list[0].style.background = '#b2b4b3';
				// redraw graph
                                createC3Charts(document.querySelectorAll('.c3-chart'));
				// for some reason the pie chart gets screwed... so redarw it here
				window.redrawPie();
			}, false);
		}
	}


	function setupCompareBattery() {
		// reset compare
		compareButton = document.querySelector('.switch-bty');
		if (compareButton) {
			var btn = compareButton.querySelector('button');
			if (btn.getAttribute('data-name') === 'charge-discharge' || btn.getAttribute('data-name') === 'bought-used') {
				// set up solar comaparision
				setupBatteryCompare();
				return;
			}
			compareButton.addEventListener('click', function () {
				if (compareButton.enable) {
					compareButton.style.background = '#b2b4b3';
					btn.style.marginLeft = 0;
					compareButton.enable = false;
					_compare = null;
					// redraw graph
					var list = document.querySelectorAll('.c3-chart');
					createC3Charts(list);
				} else {
					btn.style.marginLeft = '20px';
					compareButton.style.background = 'rgba(251, 255, 0, 1)';
					//compareButton.style.background = '#0be679';
					compareButton.enable = true;
					// by default comapre against yesterday or last month or last year...
					var d = new Date();
					switch (range) {
						case 'year':
							d.setFullYear(d.getFullYear() - 1);
							break;
						case 'month':
							d.setMonth(d.getMonth() - 1);
							break;
						case 'day':
						default:
							d.setDate(d.getDate() - 1);
							break;
					}
					_compare = [
						d.getFullYear(),
						pad(d.getMonth() + 1),
						pad(d.getDate())
					];
					var elm = document.querySelector('div[data-source]');
					createC3Charts([elm]);
					// update compare display
					updateCompDates(_compare[0], _compare[1], _compare[2]);
				}
			});
		}
	}

	function setupBatteryCompare() {
		var list = document.querySelectorAll('.switch-bty');
		if (list[0] && list[1]) {
			var btn1 = list[0].querySelector('button');
			var btn2 = list[1].querySelector('button');
			btn1.style.marginLeft = '20px';
			//list[0].style.background = '#0be679';
			list[0].style.background = 'rgba(251, 255, 0, 1)';
			scompareState = 2;
			btn2.style.marginLeft = '0px';
			list[1].style.background = '#b2b4b3';
			btn1.addEventListener('click', function () {
				btn1.style.marginLeft = '20px';
				//list[0].style.background = '#0be679';
				list[0].style.background = 'rgba(251, 255, 0, 1)';
				scompareState = 2;
				btn2.style.marginLeft = '0px';
				list[1].style.background = '#b2b4b3';
				// redraw graph
                                createC3Charts(document.querySelectorAll('.c3-chart'));
				// for some reason the pie chart gets screwed... so redarw it here
				window.redrawPie();
			}, false);
			btn2.addEventListener('click', function () {
				btn2.style.marginLeft = '20px';
				list[1].style.background = 'rgba(251, 255, 0, 1)';
				//list[1].style.background = '#0be679';
				scompareState = 3;
				btn1.style.marginLeft = '0px';
				list[0].style.background = '#b2b4b3';
				// redraw graph
                                createC3Charts(document.querySelectorAll('.c3-chart'));
				// for some reason the pie chart gets screwed... so redarw it here
				window.redrawPie();
			}, false);
		}
	}



	function controlRangeUI() {
		var yearElm = document.getElementById('unit-year');
		var monthElm = document.getElementById('unit-month');
		var dayElm = document.getElementById('unit-day');
		if (yearElm && monthElm && dayElm) {
			switch (range) {
				case 'year':
					yearElm.className = 'active';
					monthElm.className = '';
					dayElm.className = '';
					break;
				case 'month':
					yearElm.className = '';
					monthElm.className = 'active';
					dayElm.className = '';
					break;
				case 'day':
					yearElm.className = '';
					monthElm.className = '';
					dayElm.className = 'active';
					break;
			}
		}
	}

	function getChartFunction(elm) {
		if (elm.getAttribute('type') !== 'line') {
			return createCharts;
		}
		return createC3Charts;
	}

	function loadChannels(cb) {
		window.request('/channelLoad48A.php', 'GET', null, null, function (error, res) {
			if (error) {
				return console.error(error);
			}
			if (res.indexOf('LOAD NG') !== -1) {
				return console.error(res);
			}
			res = res.replace('LOAD OK,', '');
			res = res.substring(res.indexOf(',') + 1);
			channels = res.split(',').filter(function (item) {
				return item !== '';
			});
			loadConfig(cb);
		});
	}

	function loadConfig(cb) {
		window.request('/read_config.php', 'GET', null, null, function (error, res) {
			if (error) {
				return console.error(error);
			}
			for (var i in res) {
				res[i] = parseFloat(res[i]);
			}
			dayTimePrice = res.dayTimePrice || cost;
			morningTimePrice = res.morningTimePrice || cost;
			nightTimePrice = res.nightTimePrice || cost;
			dayTime = res.dayTime || 12;
			morningTime = res.morningTime || 6;
			eveningTime = res.eveningTime || 17;
			nightTime = res.nightTime || 22;
			threshold = calcThreshold(res.threshold);
			readSettings(cb);
		});
	}

	function calcThreshold(t) {
		if (!t || t <= 0) {
			t = 1;
		}
		switch (range) {
			case 'month':
				//thresholdRatio = 30;
				break;
			case 'year':
				thresholdRatio = 30;
				break;
			default:
				thresholdRatio =  48;
				break;
		}
		return t;
	}

	function readSettings(cb) {
		window.request('/read_settings.php', 'GET', null, null, function (error, res) {
			if (error) {
				return console.error(error);
			}
			settings = res;
			// show solar tab if turned on
			var stabs = document.querySelectorAll('.solar-tab');
			for (var i = 0, len = stabs.length; i < len; i++) {
				if (res.solar) {
					stabs[i].style.display = 'block';
				} else {
					stabs[i].style.display = 'none';
				}
			}
			// show battery tab if turned on
			var btabs = document.querySelectorAll('.battery-tab');
			for (var i = 0, len = btabs.length; i < len; i++) {
				if (res.battery) {
					btabs[i].style.display = 'block';
				} else {
					btabs[i].style.display = 'none';
				}
			}
			cb();
		});
	}

	// both today and yesterday...
	function getKWHData(cb) {
		var yd = new Date();
		yd.setDate(yd.getDate() - 1);
		var today = _period[0] + '.' + _period[1] + '.' + _period[2];
		var yesterday = yd.getFullYear() + '.' + pad(yd.getMonth() + 1) + '.' + pad(yd.getDate());
		var _range = range + '5' + (range === 'day' ? '_30mini' : '');
		var turl = '/eco_eye_' + _range + '.php?period=' + today + '&cute=1&solar=1';
		var yurl = '/eco_eye_' + _range + '.php?period=' + yesterday + '&cute=1&solar=1';
		request(turl, 'GET', null, null, function (error, res) {
			if (error) {
				return console.error(error);
			}
			kwhData.today = parseData(null, res);
			logger('today:', turl, kwhData.today);
			request(yurl, 'GET', null, null, function (error, res2) {
				if (error) {
					return console.error(error);
				}
				kwhData.yesterday = parseData(null, res2);
				logger('yesterday:', yurl, kwhData.yesterday);
				cb();
			});
		});
	}

	function createCharts(list) {
		for (var i = 0, len = list.length; i < len; i++) {
			if (list[i].getAttribute('type') === 'pie') {
				continue;
			}
			createChart(list[i]);
		}
	}

	function createC3Charts(list, cb) {
		var called = false;
		var callback = function () {
			if (!called && typeof cb === 'function') {
				called = true;
				cb();
			}
		};
		for (var i = 0, len = list.length; i < len; i++) {
			createC3Chart(list[i], callback);
		}
	}

	function getCulling() {
		switch (range) {
			case 'year':
				return 24;
			case 'month':
				return 31;
			case 'day':
				return 14;
			default:
				return 24;
		}
	}

	function getColorPattern() {
		var filename = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
		if (filename === 'main.html') {
			return [
				'#0435f1',
				'#ffa000'
			];
		} else if (filename === 'solar-power.html') {
			if (scompareState === 0) {
				return [
					'#284dc1',
					'#ffc038'
				];
			} else {
				return [
					'#00b22d',
					'#d34848'
				];
			}
		 }else if (filename === 'battery.html') {
			if (scompareState === 2) {
				return [
					'#db52aa',
					'#655cbf'
				];
			} else {
				return [
					'#284dc1',
					'#d34848'
				];
			}
		} else if (range === 'year' && _compare) {
			// hack... for some reason the graph lib switch the color pattern...
			return [
				'#f10418',
				'#0435f1'
			];
		}
		return [
			'#0435f1',
			'#f10418'
		];

	}

	function getYAxisMax(data) {
		var list = data.columns[1];
		var max = 0;
		// start from 1 b/c the first element is the date of the data
		for (var i = 1, len = list.length; i < len; i++) {
			if (list[i] && list[i] > max) {
				max = list[i];
			}
		}
		var paddingRate = 0.1;
		var res = (max + (max * paddingRate));
		return res;
	}

	function getYAxisValues(columns, count, padding) {
		var list = columns[1];
		if (columns[2]) {
			var m1 = getYAxisMax({ columns: [null, columns[1]]});
			var m2 = getYAxisMax({ columns: [null, columns[2]]});
			if (m1 < m2) {
				list = columns[2];
			}
		}
		var max = 0;
		var step;
		for (var i = 1, len = list.length; i < len; i++) {
			if (list[i] && list[i] > max) {
				max = list[i];
			}
		}
		if (max < 1) {
			var v = max;
			var m = 10;
			while (v < 1) {
				v *= m;
				m *= 10;
			}
			step = (max / count) * m < 5 ? 5 : 10;
			step = step / m;
		} else {
			step = max / count;
			if (step >= 1) {
				step = Math.round(step);
			} else {
				var v = max;
				var m = 10;
				while (v < 1) {
					v *= m;
					m *= 10;
				}
				step = (max / count) * m < 5 ? 5 : 10;
				step = step / m;
			}
		}
		var res = [];
		var value = 0;
		while (value <= max) {
			res.push(value);
			value += step;
		}
		res.push(value);

		// we limit the number of Y axis ticks because c3 chart has some issues with labels being cut off
		if (res.length > count + 1) {
			res = res.splice(0, res.length - 1);
		}

		return res;
	}

	function getThresholdLine() {
		switch (range) {
			case 'month':
				return threshold;
			case 'year':
				return threshold * thresholdRatio;
			default:
				return threshold / thresholdRatio;
		}
	}

	function createC3Chart(elm, cb) {
		var id = elm.getAttribute('id');
		elm.innerHTML = '';
		elm.style.width = chartSize( 'width', elm.getAttribute('width'), true );
		elm.style.height = chartSize( 'height', elm.getAttribute('height'), true );
		var duration = parseInt(elm.getAttribute('duration'), 10) || 500;
		getData(elm, function (error, data, _url) {
			if (error) {
				return console.error(error);
			}

			// remove unwanted props
			if (data && data.barData) {
				delete data.barData;
			}
			if (data && getToday() === data.current) {
				// null and hide future plots (we do this in getDataPlots() but some comparison needs to be done here)
				for (var i = 1, len = _compare ? data.columns.length - 1 : data.columns.length; i < len; i++) {
					nullFuturePlots(data.columns[i]);
				}
			}
			// set configurations for the chart
			var conf = {
				bindto: elm,
				data: data,
				size: {
					width: elm.clientWidth,
					height: elm.clientHeight
				},
				padding: {
					top: 20,
					bottom: 15
				},
				tooltip: {
					show: true,
					format: {
						value: function (value) { return value.toFixed(3) + ' kWh'; }
					}
				},
				line: {
					connectNull: false,
				},
				grid: {
					x: {
						show: false,
					},
					y: {
						show: true,
						lines: [
							{ value: getThresholdLine(), class: 'threshold', text: '' }
						]
					}
				},
				color: {
					pattern: getColorPattern()
				},
				axis: {
					x: {
						type: types[range],
						tick: {
							rotate: range === 'month' ? -55 : -35,
							culling: { max: getCulling() },
							format: formats[range]
						}
					},
					y: {
						type: '',
						tick: {
							format: function (_y) {
								var y = _y;
								try {
									if (y < 1) {
										if (y < 0.1) {
											y = y.toFixed(3);
										} else {
											y = y.toFixed(2);
										}
									} else {
										y.toFixed(1);
									}
									if (y === '') {
										y = '0';
									}
									return y + ' kWh';
								} catch (e) {
									console.error(e);
									return y + 'kWh';
								}
							}
						},
						min: 0,
						padding: { bottom: 0, top: 10 }
					}
				}
			};
			if (data && getYAxisMax(data)) {
				var manualPadding = 0;
				var count = 10;
				conf.axis.y.tick.values = getYAxisValues(data.usedForYTicks, count, manualPadding);
			}
			var filename = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
			if (filename !== 'main.html' && filename !== 'power.html' && filename !== 'battery.html') {
				delete conf.grid.y.lines;
			}
			try {
				// draw chart
				c3.generate(conf);
			} catch (e) {
				//alert(e.message);
			}
			// call pie chart creation
			cb();
			// make the list of plots invisible
			window.setTimeout(function () {
				var svg = elm.querySelector('svg');
				if (!svg) {
					return;
				}
				var legends = svg.querySelectorAll('.c3-legend-item');
				if (legends) {
					for (var i = 0, len = legends.length; i < len; i++) {
						legends[i].style.display = 'none';
					}
				}
				svg.style.margin = '20px 0 auto';
				var gs = svg.querySelectorAll('g[transform]:not([class])');
				if (!gs || !gs[2]) {
					return;
				}
				gs[2].style.marginTop = '4px';
				// hack to make tooltip invisible but keep the highlight of graid
				var ttp = document.querySelector('.c3-tooltip-container');
				if (ttp) {
					ttp.style.opacity = 1;
				}
			}, 0);
		});
	}
	
	
	//battery state
		var xhr = new XMLHttpRequest();
		xhr.open('GET', '/get_property_battery_class.php?q=str', true);
		xhr.send();

		xhr.onreadystatechange = function() {
  			if(xhr.readyState === 4 && xhr.status === 200) {
			var rcvStr = ( xhr.responseText )
			var propArry = rcvStr.split( "," );
			var mode;
	
 				if (propArry[0] == "on")
 				{
 				if (propArry[1] == "1"){
 					mode = "充電中";
				}else if (propArry[1] == "2"){
 					mode = "放電中";
				}else{
 					mode = "待機中";
				}
 			document.getElementById("state").innerHTML = mode;
  			document.getElementById("battery_num").innerHTML = propArry[2]+"%";
			document.getElementById("battery-bgm").style.width = propArry[2]-"6"+"%";
 			}
 			else{
 			document.getElementById("state").innerHTML = "電源OFF";
 	  		document.getElementById("battery_charge").innerHTML = "蓄電池";
 	  		document.getElementById("battery_num").innerHTML = "停止中";
			}
		}  		
		}




	function createChart(elm) {
		var id = elm.getAttribute('id');
		elm.style.width = chartSize( 'width', elm.getAttribute('width') );
		elm.style.height = chartSize( 'height', elm.getAttribute('height') );
		var svg = elm.querySelector('svg');
		svg.style.width = elm.style.width;
		svg.style.height = elm.style.height;
		var duration = parseInt(elm.getAttribute('duration'), 10) || 500;
		nv.addGraph(function () {
			var chart = getChart(elm);
			chart.tooltip.hidden(true);
			setupOptions(chart);
			setupAxis(elm, chart);
			getData(elm, function getDataCallback(error, data) {
				if (error) {
					return console.error(elm, error);
				}
				// sad hack to handle constitution.html
				if (elm.getAttribute('type') === 'horizontal-bar') {
					data = formatBarData(data);
					elm.style.overflowY = 'scroll';
					elm.style.overflowX = 'hidden';
				}
				var selected = d3.select('#' + id + ' svg');
				selected = selected.datum(data);
				selected = selected.transition();
				selected = selected.duration(duration);
				selected.call(chart);
				// update display
				getKWHData(updateDisplays);
			});
			return chart;
		});
	}

	function chartSize(type, style, c3) {
		var offset = c3 ? 40 : 0;
		var size = style ? parseInt(style.replace('px', '')) - offset : 999999;
		var rightBlock = document.getElementById('right-block');
		var name = 'client' + type[0].toUpperCase() + type.substring(1);
		if (c3) {
			return '96%';
		}
		if (rightBlock[name] > 0 && size > rightBlock[name]) {
			// FIXME: hack...
			if (type === 'height') {
				var height = c3 ? rightBlock[name] - 20 : rightBlock[name];
				if (rightBlock.style.height === '') {
					rightBlock.style.height = rightBlock[name] + 'px';
				} else {
					height = parseFloat(rightBlock.style.height.replace('px', ''));
				}
			}
			return height + 'px';
		}
		return style;
	}

	function getChart(elm) {
		var type = elm.getAttribute('type');
		switch (type) {
			case 'line':
				return nv.models.lineChart()
					.useInteractiveGuideline(true);
			case 'horizontal-bar':
				return nv.models.multiBarHorizontalChart()
					.x(function (d) { return d.label; })
					.y(function (d) { return d.value; })
					.margin({ top: 30, right: 20, bottom: 50, left: 180 })
					.showValues(true)
					.showControls(false);
			case 'pie':
				return nv.models.pieChart()
					.x(function (d) { return d.label; })
					.y(function (d) { return d.value; })
					.showLabels(false);
		}
	}

	function setupOptions(chart) {
		nv.utils.windowResize(chart.update);
	}

	function setupAxis(elm, chart) {
		if (!chart.xAxis) {
			return;
		}
		chart.xAxis.axisLabel(elm.getAttribute('x-lbable'));
		chart.yAxis.axisLabel(elm.getAttribute('y-lable'));
		/*
		chart.yAxis.tickFormat(function (d) {
			return d.split(':')[0];
		});
		*/
	}

	function changeTime(id) {
		var elm = document.getElementById(id);
		var select = elm.querySelector('select');
		var value = parseInt(select.value);
		var timeElm = document.querySelector('.time-display');
		if (value == -1) {
			timeElm.textContent = '１日';
		} else {
			timeElm.textContent = value + '時台';
		}
		_timeRange = value;
		var elm = document.querySelector('div[data-source]');
		createCharts([elm]);
	}

	function setEasyCompare(id) {
		if (compareButton) {
			compareButton.enable = true;
		}
		compareButton.style.background = 'rgba(251, 255, 0, 1)';
		//compareButton.style.background = '#0be679';
		var btn = compareButton.querySelector('button');
		btn.style.marginLeft = '20px';
		var elm = document.getElementById(id);
		var select = elm.querySelector('select');
		// the fact that we need to check against text values....
		var d = new Date();
		switch (select.value) {
			case 'today':
				d.setDate(d.getDate() - 0);
				break;
			case '-1d':
				d.setDate(d.getDate() - 1);
				break;
			case '-2d':
				d.setDate(d.getDate() - 2);
				break;
			case '-3d':
				d.setDate(d.getDate() - 3);
				break;
			case '-7d':
				d.setDate(d.getDate() - 7);
				break;
			case '-14d':
				d.setDate(d.getDate() - 14);
				break;
			case '-21d':
				d.setDate(d.getDate() - 21);
				break;
			case '-1m':
				d.setMonth(d.getMonth() - 1);
				break;
			case '-2m':
				d.setMonth(d.getMonth() - 2);
				break;
			case '-3m':
				d.setMonth(d.getMonth() - 3);
				break;
			case '-6m':
				d.setMonth(d.getMonth() - 6);
				break;
			case '-9m':
				d.setMonth(d.getMonth() - 9);
				break;
			case '-1y':
				d.setFullYear(d.getFullYear() - 1);
				break;
			case '-2y':
				d.setFullYear(d.getFullYear() - 2);
				break;
			case '-3y':
				d.setFullYear(d.getFullYear() - 3);
				break;
		}
		_compare = [
			d.getFullYear(),
			pad(d.getMonth() + 1),
			pad(d.getDate())
		];
		var elm = document.querySelector('div[data-source]');
		createC3Charts([elm]);
		// update compare display
		updateCompDates(_compare[0], _compare[1], _compare[2]);
	}

	function changeEasyDate(id) {
		if (compareButton) {
			compareButton.enable = true;
		}
		var elm = document.getElementById(id);
		var select = elm.querySelector('select');
		var d = new Date();
		switch (select.value) {
			case 'today':
				d.setDate(d.getDate() - 0);
				break;
			case '-1d':
				d.setDate(d.getDate() - 1);
				break;
			case '-2d':
				d.setDate(d.getDate() - 2);
				break;
			case '-3d':
				d.setDate(d.getDate() - 3);
				break;
			case '-7d':
				d.setDate(d.getDate() - 7);
				break;
			case '-14d':
				d.setDate(d.getDate() - 14);
				break;
			case '-21d':
				d.setDate(d.getDate() - 21);
				break;
			case '-1m':
				d.setMonth(d.getMonth() - 1);
				break;
			case '-2m':
				d.setMonth(d.getMonth() - 2);
				break;
			case '-3m':
				d.setMonth(d.getMonth() - 3);
				break;
			case '-6m':
				d.setMonth(d.getMonth() - 6);
				break;
			case '-9m':
				d.setMonth(d.getMonth() - 9);
				break;
			case '-1y':
				d.setFullYear(d.getFullYear() - 1);
				break;
			case '-2y':
				d.setFullYear(d.getFullYear() - 2);
				break;
			case '-3y':
				d.setFullYear(d.getFullYear() - 3);
				break;
		}
		_period = [
			d.getFullYear(),
			pad(d.getMonth() + 1),
			pad(d.getDate())
		];
		var elm = document.querySelector('.graph-chart');
		var func = getChartFunction(elm);
		func([elm]);
		// re-draw displays
		getKWHData(updateDisplays);
		// update date displays
		updateDates(d.getFullYear(), d.getMonth() + 1, d.getDate());
	}

	function changeDate(dateString, dateObj) {
		var year = dateObj.selectedYear;
		var month = dateObj.selectedMonth + 1;
		var day = dateObj.selectedDay;
		//var elm = document.querySelector('div[data-source]');
		var elm = document.querySelector('.graph-chart');
		// change _period to the selected period
		_period = [ year, pad(month), pad(day) ];
		// re-draw displays
		getKWHData(updateDisplays);
		// re-draw graph
		var func = getChartFunction(elm);
		func([elm]);
		// update date displays
		updateDates(year, month, day);
	}

	function setCompare(dateString, dateObj) {
		var btn = compareButton.querySelector('button');
		btn.style.marginLeft = '20px';
		compareButton.enable = true;
		compareButton.style.background = 'rgba(251, 255, 0, 1)';
		//compareButton.style.background = '#0be679';
		var year = dateObj.selectedYear;
		var month = dateObj.selectedMonth + 1;
		var day = dateObj.selectedDay;
		var elm = document.querySelector('div[data-source]');
		// change _compare to the selected period
		_compare = [ year, pad(month), pad(day) ];
		// re-draw graph
		createC3Charts([elm]);
		// update compare display
		updateCompDates(_compare[0], _compare[1], _compare[2]);
	}

	function updateDates(year, month, day) {
		var now = new Date();
		var dates = document.querySelectorAll('.date');
		for (var i = 0, len = dates.length; i < len; i++) {
			if (now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day) {
				dates[i].textContent = todayLabel;
			} else {
				dates[i].textContent = year + '年' + (range !== 'year' ? pad(month) + '月' : '') + (range === 'day' ? pad(day) + '日' : '');
			}
		}
	}

	function updateCompDates(year, month, day) {
		var now = new Date();
		var dates = document.querySelectorAll('.comp-date');
		for (var i = 0, len = dates.length; i < len; i++) {
			if (now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day) {
				dates[i].textContent = todayLabel;
			} else {
				dates[i].textContent = year + '年' + (range !== 'year' ? pad(month) + '月' : '') + (range === 'day' ? pad(day) + '日' : '');
			}
		}
	}

	function getData(elm, cb) {
		var data = null;
		var _range = range + '5';
		var source = elm.getAttribute('data-source');
		if (!source) {
			return cb();
		}
		if (source.indexOf('url:') === 0) {
			var period = getPeriod(_period);
			if (range === 'day') {
				_range = 'day5_30mini';
			}
			var url = source.replace('url:', '').replace('{RANGE}', _range).replace('{PERIOD}', period);
			logger('get data:', url);
			request(url, 'GET', null, null, function (error, res) {
				if (error) {
					return console.error(error);
				}
				if (_compare) {
					var url2 = source.replace('url:', '').replace('{RANGE}', _range).replace('{PERIOD}', getPeriod(_compare));
					request(url2, 'GET', null, null, function (error, res2) {
						if (error) {
							return console.error(error);
						}
						processData(res, res2, cb);
					});
					return;
				}
				// TODO: for now i dont feel like breaking the sample pie
				source = 'sample';
				data = window[source] || null;
				elm.data = data;
				processData(res, null, cb, url);
			});
			return;
		}
		// local object as data source
		data = window[source] || null;
		// now handle graph
		cb(null, data);
	}

	function updateDisplays() {
		updateElms('bought', ( kwhData.today.bought ).toFixed(3));
		updateElms('sold', ( kwhData.today.sold ).toFixed(3));
		updateElms('current', calcBought(kwhData.today));
		updateElms('generated', (kwhData.today.generated).toFixed(3));
		updateElms('predicted-cost', predictCost(kwhData.today));
		updateElms('today-cost', calcCost(kwhData.today));
		updateElms('today-bought', calcBought(kwhData.today));
		updateElms('yesterday-cost', calcCost(kwhData.yesterday));
		updateElms('yesterday-bought', calcBought(kwhData.yesterday));
		updateElms('charge', ( kwhData.today.charge ).toFixed(3));
		updateElms('discharge', ( kwhData.today.discharge ).toFixed(3));
	}

	function calcCost(data) {
		//return calcKwhFromLists(data.boughtList, data.generatedList, data.soldList);
		// so this is what the app does...
		return calcKwhFromLists(data.boughtList, [], []);
	}

	function predictCost(data) {
		var d = new Date();
		// x 2 b/c boughtList is in 30 minutes NOT in hours
		var rightNow = d.getHours() * 2;
		var costSoFar = calcKwhFromLists(data.boughtList, [], []);
		var remainingHours = data.boughtList.length - rightNow;

		logger('predict:', rightNow, costSoFar, remainingHours);

		var value = Math.round(( remainingHours * (costSoFar / rightNow) ) + costSoFar);
		if (isNaN(value)) {
			value = 0;
		}
		return value;
	}

	function calcKwhFromLists(blist, glist, slist) {
		// we assume all 3 lists have the same length
		var hour = 0;
		var kwhPerHour = [];
		for (var i = 0, len = blist.length; i < len; i++) {
			var b = blist[i] || 0;
			var g = glist[i] || 0;
			var s = slist[i] || 0;
			var kwh = b + (g - s);
			if (kwhPerHour[hour] === undefined) {
				kwhPerHour[hour] = kwh;
			} else {
				kwhPerHour[hour] += kwh;
				hour += 1;
			}
		}

		logger('kwh per hour', kwhPerHour);

		var total = 0;
		for (var j = 0, jen = kwhPerHour.length; j < jen; j++) {
			var hour = j;
			var hourValue = kwhPerHour[hour];
			if (hour >= morningTime && hour < dayTime) {
                                total += hourValue * morningTimePrice;

				logger('cost by hour (morning)', hour + ':00', hourValue * morningTimePrice, 'yen', hourValue, 'kwh *', morningTimePrice, 'yen/kwh');

                        } else if (hour >= dayTime && hour < eveningTime) {
                                total += hourValue * dayTimePrice;

				logger('cost by hour (day)', hour + ':00', hourValue * dayTimePrice, 'yen', hourValue, 'kwh *', dayTimePrice, 'yen/kwh');

                        } else if (hour >= eveningTime && hour < nightTime ) {
                                total += hourValue * morningTimePrice;

				logger('cost by hour (evening)', hour + ':00', hourValue * morningTimePrice, 'yen', hourValue, 'kwh *', morningTimePrice, 'yen/kwh');

                        } else {
                                total += hourValue * nightTimePrice;

				logger('cost by hour (night)', hour + ':00', hourValue * nightTimePrice, 'yen', hourValue, 'kwh *', nightTimePrice, 'yen/kwh');
			}
		}
		var cost = Math.round(total);

		logger('Total cost so far:', cost, 'yen');

		return cost;
	}

	function calcBought(data) {
		var gen = data.generated;
		var sold = data.sold;
		var bought = data.bought;
		return (bought + (gen - sold)).toFixed(3);
	}

	function updateElms(cls, value) {
		var elms = document.querySelectorAll('.' + cls);
		for (var i = 0, len = elms.length; i < len; i++) {
			elms[i].textContent = value;
		}
	}

	function parseData(p, res, _url) {
		var boughtData = 0;
		var boughtListData = [];
		var soldData = 0;
		var soldListData = [];
		var generatedData = 0;
		var generatedListData = [];
		var solarData = 0;
		var dischargeData = 0;
		var chargeData = 0;
		var dischargePlots = [];
		var chargePlots = [];
		var splots;
		var solarPlots;
		var cols = [];
		var linePlots = [];
		var xRead = false;
		var sep = res.split('CHANNEL;');
		var removeEmpty = function (item) {
			return item !== '\n' && item !== '\r';
		};
		var num = function (item) {
			return parseFloat(item);
		};
		var parse = function (item) {
			var list = item.replace('KWH', '').split(';').filter(function (element) {
				return element !== '';
			});
			return list.map(num);
		}
		var formatX = function (_list) {
			var ret = [];
			for (var i = 0, len = _list.length; i < len; i++) {
				// sad offset b/c the data starts from 1 to 24 but the display has to be 0 to 23....
				//var item = parseInt(_list[i]) - 1;
				var item = parseInt(_list[i]);
				switch (range) {
					case 'day':
						if (isNaN(item)) {
							item = pad(parseInt(_list[i - 1]) - 1) + ':30:00';
							//item = pad(parseInt(_list[i - 1])) + ':30:00';
						} else {
							// it seems the array needs to start from 00:00...
							item = pad(item - 1) + ':00:00';
							//item = pad(item) + ':00:00';
						}
						var d = new Date(_period[0] + '/'+ _period[1] + '/' + _period[2]  + ' ' + item);
						if (!isNaN(d.getTime())) {
							ret.push(d);
						}
						break;
					case 'month':
					case 'year':
						if (!isNaN(item)) {
							ret.push(item);
						}
						break;
				}
			}
			return ret;
		};
		var total = 0;
		var forBar = {};
		for (var i = 0, len = sep.length; i < len; i++) {
			if (!sep[i]) {
				continue;
			}
			var items = sep[i].split(/(\n|\r)/g).filter(removeEmpty);
			var channel = parseInt(items[0].replace('CH', '').replace(';', ''));
			var name = items[1].replace('NAME;', '').replace(';', '');
			if (name === '') {
				name = '[回路:' + channel + ']';
			} else if (channel < 100) {
				name = name + '[回路:' + channel + ']';
			}

			logger('channel:', channel, name, '>', items[4], parse(items[4]));

			if (channel === 0) {
				boughtData = add(items[4].replace('KWH;', '').split(';').map(num));
				boughtListData = parse(items[4]);
				linePlots = items[4].replace('KWH;', '').split(';').map(num);
				var plots = [name];
				var x = formatX(items[3].replace('PERIOD;', '').split(';'));
				logger('x', x, items[3]);
				cols.push(plots.concat(x));
				// we no longer use all channels to plot line graph but channel 0: 2017/05/31
				//cols.push(plots.concat(y));
				cols.push(plots.concat(linePlots));
				logger('graph data: channel', channel, 'time', items[3], 'value', items[4]);
				continue;
			}
			if (channel === 100) {
				soldData = add(items[4].replace('KWH', '').split(';').map(num));
				//soldListData = items[4].replace('KWH;', '').split(';').map(num);
				soldListData = parse(items[4]);
				continue;
			}
			if (channel === 101) {
				if (settings.ecocute) {
					forBar['エコキュート'] = getTimeRange(items[4].replace('KWH', '').split(';').map(num));
					var plots = [];
					var y = items[4].replace('KWH;', '').split(';').map(num);
					plots = [name];
					cols.push(plots.concat(y));
				}
				continue;
			}
			if (channel === 102) {
				generatedData = add(items[4].replace('KWH', '').split(';').map(num));
				generatedListData = parse(items[4]);
				splots = parse(items[4]);
				if (settings.solar) {
					forBar['太陽光発電消費量'] = getTimeRange(items[4].replace('KWH', '').split(';').map(num));
				}
				continue;
			}
			if (channel === 103) {
				solarData = add(items[4].replace('KWH', '').split(';').map(num));
				solarPlots = parse(items[4]);
				if (settings.solar) {
					forBar['太陽光発電消費量'] = getTimeRange(items[4].replace('KWH', '').split(';').map(num));
				}
				continue;
			}
			if (channel === 104) {
				dischargeData = add(items[4].replace('KWH', '').split(';').map(num));
				dischargePlots = parse(items[4]);
				if (settings.battery) {
					forBar['放電'] = getTimeRange(items[4].replace('KWH', '').split(';').map(num));
				}
				continue;
			}
			if (channel === 105) {
				chargeData = add(items[4].replace('KWH', '').split(';').map(num));
				chargePlots = parse(items[4]);
				if (settings.battery) {
					forBar['充電'] = getTimeRange(items[4].replace('KWH', '').split(';').map(num));
				}
				continue;
			}
			if (channel !== 0 && channel !== 100 && channel !== 102) {
				total += add(items[4].replace('KWH', '').split(';').map(num));
			}

			var y = items[4].replace('KWH;', '').split(';').map(num);
			/*
			var plots = [];
			if (!xRead) {
				plots = ['x'];
				var x = formatX(items[3].replace('PERIOD;', '').split(';'));
				logger('x', x, items[3]);
				cols.push(plots.concat(x));
				xRead = true;
			}
			plots = [name];
			// we no longer use all channels to plot line graph but channel 0: 2017/05/31
			//cols.push(plots.concat(y));
			cols.push(plots.concat(linePlots));
			*/
			forBar[name] = getTimeRange(y);
		}
		// so channel 0 is missing....
		if (boughtData === 0) {
			boughtData = total;
		}
		var columnData = [ cols[0] ];
		// combine all channels into one for line chart
		var columns = [ getPeriod(p) ];
		// var i = 1 b/c the first element in the array is for x axis
		for (var i = 1, len = cols.length; i < len; i++) {
			combineColumns(columns, cols[i]);
		}
		logger('channel 0:', getPeriod(p), boughtData, columns, boughtList);
		columnData.push(columns);
		// solar data columns for solar display
                var solarColumns = [ columnData[0] ];
                var scolumns = [ '発電量' ];
                if (!splots) {
			// when we have no channel 102
			splots = [];
			for (var i = 0; i < 48; i++) {
				splots.push(0);
			}
		}
		scolumns = scolumns.concat(splots);
                solarColumns.push(scolumns);

		// discharge data columns for battery display
		var dischargeColumns = [ columnData[0] ];
		var dcColumns = [ '放電量' ];
		dcColumns = dcColumns.concat(dischargePlots);
		dischargeColumns.push(dcColumns);

		// charge data columns for battery display
		var chargeColumns = [ columnData[0] ];
		var cColumns = [ '充電量' ];
		cColumns = cColumns.concat(chargePlots);
		chargeColumns.push(cColumns);

		// sold data columns for solar display
                var soldColumns = [ columnData[0] ];
                var sdcolumns = [ '売電量' ];
                sdcolumns = sdcolumns.concat(soldListData);
                soldColumns.push(sdcolumns);

		// bought data columns for solar display
                var boughtColumns = [ columnData[0] ];
                var bcolumns = [ '買電量' ];
                bcolumns = bcolumns.concat(boughtListData);
                boughtColumns.push(bcolumns);

		// create labels for data columns
		var parsedColumn = parseColumnData(columnData);

		// when we use channel 0 only to plot line graph
		parsedColumn[0][0] = 'x';

		if (_url) {
			/*
			parsedColumn[1].forEach(function (value) {
				if (value !== null) {
					last30MinUsage = value;
				}
			});
			*/
			totalUsage = total;
		}

		console.log(forBar);

		return {
			current: parsedColumn[1][0],
			columns: parsedColumn,
			solarColumns: solarColumns,
			dischargeColumns: dischargeColumns,
			chargeColumns: chargeColumns,
			boughtColumns: boughtColumns,
			soldColumns: soldColumns,
			generated: generatedData,
			bought: boughtData,
			boughtList: boughtListData,
			generatedList: generatedListData,
			soldList: soldListData,
			solar: solarData,
			charge:chargeData,
			discharge:dischargeData,
			sold: soldData,
			barData: forBar,
		};
	}

	function parseColumnData(columnData) {
		return [
			getDataLabels(columnData),
			getDataPlots(columnData)
		];
	}

	function getDataLabels(columnData) {
		if (!columnData[0]) {
			console.error('Invalid column data to get labels', columnData);
			return [];
		}
		var labels = [ columnData[0].shift() ];
		var step = 0;
		switch (range) {
			case 'year':
				break;
			case 'month':
				break;
			case 'day':
			default:
				//step = 2;
				break;
		}
		for (var i = 0, len = columnData[0].length; i < len; i++) {
			if (i % step !== 0) {
				labels.push(columnData[0][i]);
			}
		}
		return labels;
	}

	function getDataPlots(columnData) {
		if (!columnData[0]) {
			console.error('Invalid column data to get plots', columnData);
			return [];
		}
		var today = getToday();
		var future = getFuture();
		var plots = [ columnData[1].shift() ];
		//var step = range === 'day' ? 2 : 0;
		var step = 0;
		var value = 0;
		for (var i = 0, len = columnData[0].length; i < len; i++) {
			var col = columnData[0][i];
			if (i % step !== 0) {
				// today === plots[0] is to make sure we plot all data except for today
				if (today === plots[0] && i > future) {
					plots.push(null);
				} else {
					value += columnData[1][i];
					plots.push(value);
				}
				value = 0;
				continue;
			}
			if (i < future) {
				value += columnData[1][i];
			}
		}
		return plots;
	}

	function nullFuturePlots(plots) {
		var future = getFuture();
		for (var i = 0, len = plots.length; i < len; i++) {
			if (i > future) {
				plots[i] = null;
			}
		}
		return plots;
	}

	function getToday() {
		var d = new Date();
		switch (range) {
			case 'month':
				return d.getFullYear() + '.' + pad(d.getMonth() + 1);
			case 'year':
				return d.getFullYear();
			case 'day':
			default:
				return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
		}
	}

	function getFuture() {
		var d = new Date();
		switch (range) {
			case 'month':
				return d.getDate();
			case 'year':
				return d.getMonth() + 1;
			case 'day':
			default:
				return (d.getHours() * 2) + (d.getMinutes() >= 30 ? 1 : 0);
		}
	}

	function getTimeRange(values) {
		if (_timeRange >= 0) {
			// each element is 30 minutes
			return values.splice(_timeRange * 2, 2)
		}
		// there's NaN at the end of array... :-(
		return values.splice(0, values.length - 1);
	}

	function processData(res, res2, cb, _url) {
		var parsed = parseData(_period, res, _url);
		var data = {
			x: 'x',
			current: parsed.current,
			columns: parsed.columns,
			barData: parsed.barData,
			usedForYTicks: parsed.columns
		};
		bought = parsed.bought;
		boughtList = parsed.boughtList;
		sold = parsed.sold;
		generated = parsed.generated;

		logger('processed:', _url, _period, parsed);
		// compare
		if (res2) {
			var parsed2 = parseData(_compare, res2);
			data.columns.push(parsed2.columns[1]);
			// find which data set has the higher value(s) for manual Y axis ticking...
			var resMax = getYAxisMax(parsed);
			var res2Max = getYAxisMax(parsed2);
			if (resMax < res2Max) {
				data.usedForYTicks = parsed2.columns;
			}
		}

		// solar...
		var filename = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
		if (filename === 'solar-power.html') {
			data.columns[1][0] = '消費量';
			if (scompareState === 0) {
				data.columns.push(parsed.solarColumns[1]);
			} else {
				data.columns[1] = parsed.soldColumns[1];
				data.columns.push(parsed.boughtColumns[1]);
			}
		}
		// battery...
		if (filename === 'battery.html') {
			data.columns[1][0] = '消費量';
			if (scompareState === 2) {
			data.columns[1] = parsed.chargeColumns[1];
			data.columns.push(parsed.dischargeColumns[1]);
			} else {
				data.columns.push(parsed.boughtColumns[1]);
			}
		}
		cb(null, data, _url);
	}

	function combineColumns(arr1, arr2) {
		// var i = 1 b/c the first element in the array is a name
		for (var i = 1, len = arr2.length; i < len; i++) {
			if (!arr1[i]) {
				arr1[i] = 0;
			}
			arr1[i] += arr2[i] || 0;
		}
	}

	function formatBarData(data) {
		var item = {
			key: getPeriod(_period),
			//color: '#ffbb4c',
			color: '#0435f1',
			values: []
		};
		var space = function (count) {
			var ret = '';
			while (count) {
				ret += ' ';
				count -=1;
			}
			return ret;
		};
		var i = 0;
		for (var name in data.barData) {
			var list = data.barData[name];
			var value = 0;
			for (var j = 0, jen = list.length; j < jen; j++) {
				if (isNaN(list[j])) {
					continue;
				}
				value += list[j];
			}
			var label = name;
			if (label.indexOf('_empty_') === 0) {
				label = space(i);
				i += 1;
			} else {
				var isAsciiOnly = ASCII.test(label);
				var limit = isAsciiOnly ? CHAR_LIMIT * 2 : CHAR_LIMIT
				var index = label.lastIndexOf('[');
				var labelName = label.substring(0, index);
				var chName = label.replace(labelName, '');
				label = labelName.length > limit ? labelName.substring(0, limit - 3) + '...' + chName : label;
			}
			item.values.push({
				label: label,
				value: value
			});
		}
		return [ item ];
	}

	function add(list) {
		var res = 0;
		for (var i = 0, len = list.length; i < len; i++) {
			if (isNaN(list[i])) {
				continue;
			}
			res += parseFloat(list[i]);
		}
		return res;
	}

	// sample data functions
	function sampleLineData() {
		var sin = [];
		var cos = [];

		for (var i = 0; i < 100; i++) {
			sin.push({x: i, y: Math.sin(i/10)});
			cos.push({x: i, y: .5 * Math.cos(i/10)});
		}

		return [
			{
				values: sin,
				key: 'Sine Wave',
				color: '#ff7f0e'
			},
			{
				values: cos,
				key: 'Cosine Wave',
				color: '#2ca02c'
			}
		];
	}

	function createPieChartData() {
		var b = bought + (generated - sold);
		var value = b === 0 ? 0 : Math.floor( (b / threshold) * 100 );
		var base = 100 - value < 0 ? 0 : 100 - value;
		var data = [
			{ label: '', value: Math.min(100, value), color: '#ffc380'  },
			{ label: '', value: base, color: '#fff' }
		];
		return {
			value: value,
			data: data
		};
	}

	function createPieChart() {
		var elm = document.querySelector('.pie-chart');
		if (!elm) {
			return;
		}
		var size = code === 'pc' ? 271 : 220;
		var chartData = createPieChartData();
		var value = Math.round(chartData.value);
		window.createPie(elm, size, value, function (error, top) {
			if (error) {
				return console.error(error);
			}

			if (value > 9999) {
				value = 9999;
			}

			// text
			var text = document.createElement('div');
			text.innerHTML = '<span>目標値の</span><br />';
			text.innerHTML += '<span style="line-height: 32px; font-weight: bold; font-size: 30px;">' + value + '%</span>';
			text.innerHTML += '<br /><span>使っています</span>';
			text.style.fontWight = 'bold';
			text.style.fontSize = '14px';
			text.style.marginTop = '9px';
			text.style.padding = '4px';
			text.style.lineHeight = '22px';
			top.appendChild(text);
			// icon
			var icon = document.createElement('img');
			var src = 'common/images/graph/';
			/*
			var last30MinPercentage = (last30MinUsage / threshold) * 100;
			if (last30MinPercentage <= 70) {
				src += '70.png';
			} else if (last30MinPercentage > 70 && last30MinPercentage <= 90) {
				src += '71.png';
			} else if (last30MinPercentage > 90 && last30MinPercentage <= 100) {
				src += '91.png';
			} else {
				src += '101.png';
			}
			*/
			var percentage = (totalUsage / threshold) * 100;
			if (percentage <= 70) {
				src += '70.png';
			} else if (percentage > 70 && percentage <= 90) {
				src += '71.png';
			} else if (percentage > 90 && percentage <= 100) {
				src += '91.png';
			} else {
				src += '101.png';
			}

			icon.setAttribute('height', 70);
			icon.setAttribute('src', src + '?' + Date.now());
			top.appendChild(icon);
			// language
			window.setLanguage();
		});
	}

	function createSolarPieChartData() {
		var used = bought + (generated - sold);
                var value = ( (generated / used) * 100 ).toFixed(1);
                var base = 100 - value < 0 ? 0 : 100 - value;
                var data = [
                        { label: '', value: value > 100 ? 100 : value, color: '#ffc038' },
                        { label: '', value: value > 100 ? 0 : base, color: '#fff' }
                ];
                return {
                        value: isNaN(value) ? 0 : value,
                        data: data
                };
        }

	function createSolarPieChart() {
		var elm = document.querySelector('.solar-pie-chart');
		if (!elm) {
			return;
		}
		var chartData = createSolarPieChartData();
		var value = Math.round(chartData.value);
		var pieSize = 120;
		if (window.code === 'tablet') {
			pieSize = 190;
		}
		window.createPie(elm, pieSize, value, function (error, top) {
			if (error) {
				return console.error(error);
			}
			var lb = window.lightingBolt(200, 140);
			lb.style.transform = 'scale(1.3, 1) rotate(170deg)';
			lb.style.margin = '11px -15px';
			top.appendChild(lb);
			var text = document.createElement('span');

			if (value > 9999) {
				value = 9999;
			}

			text.innerHTML = '<div>自給率</div><div style="font-weight: bold; font-size: 40px;">' + value + '%</div>';
			text.style.fontWight = 'bold';
			text.style.fontSize = '30px';
			text.style.position = 'relative';
			text.style.top = '-176px';
			text.style.padding = '4px';
			text.style.transform = 'scale(1)';
			top.appendChild(text);
			// language
			window.setLanguage();
		});
	}

	function getPeriod(p) {
		if (!p) {
			var d = new Date();
			p = [
				d.getFullYear(),
				pad(d.getMonth() + 1),
				pad(d.getDate())
			];
		}
		if (range === 'day') {
			return p[0] + '.' + pad(p[1]) + '.' + pad(p[2]);
		} else if (range === 'month') {
			return p[0] + '.' + pad(p[1]);
		} else if (range === 'year') {
			return p[0];
		}
	}

	function pad(n) {
		n = parseInt(n, 10);
		if (n < 10) {
			return '0' + n;
		}
		return n;
	}

	function logger() {
		if (!logging) {
			return loggingBuffer.push(arguments);
		}
		console.log.apply(console, arguments);
	}

	window.outputLog = function () {
		for (var i = 0, len = loggingBuffer.length; i < len; i++) {
			console.log.apply(console, loggingBuffer[i]);
		}
	};

	window.setupCalendar = function (that, onSelect) {
		var range = window.getChartRange();
		if (range === 'month' || range === 'year') {
			if (that[0].lock) {
				return that.prev('input').monthpicker('show');
			}
			that[0].lock = true;
			var currentYear = new Date().getFullYear();
			var mon = that.prev('input').monthpicker({
				pattern: 'yyyy/mm',
				selectedYear: new Date().getFullYear(),
				startYear: new Date().getFullYear() - 3,
				finalYear: new Date().getFullYear(),
				monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
			}).bind('monthpicker-click-month', function (event, month) {
				var list = $(this).prev('input').context.value.split('/');
				var d = {
					selectedYear: list[0],
					selectedMonth: parseInt(list[1]) - 1,
					selectedDay: 1
				};
				onSelect($(this).prev('input').context.value + '/01 00:00:00', d);
			}).bind('monthpicker-show', function () {
				var position = that.offset();
				$('.ui-datepicker').css(position);
				if (range === 'year') {
					var id;
					var list = $('.ui-datepicker');
					for (var i = 0, len = list.length; i < len; i++) {
						if (list[i].lock) {
							continue;
						}
						id = list[i].getAttribute('id');
						break;
					}
					var elm = document.getElementById(id);
					if (!elm) {
						return;
					}
					elm.querySelector('.ui-datepicker-header').style.marginBottom = '3px';
					elm.querySelector('.ui-datepicker table').style.display = 'none';
					if (elm.lock) {
						return;
					}
					elm.lock = true;
					elm.querySelector('.mtz-monthpicker-year').addEventListener('change', function () {
						that.prev('input').val(this.value);
						var d = {
							selectedYear: this.value,
							selectedMonth: 0,
							selectedDay: 1
						};
						onSelect(this.value + '/01/01 00:00:00', d);
						that.prev('input').monthpicker('hide');
					}, false);
				}
			});
			that.prev('input').monthpicker('show');
		} else {
			that.prev('input').datepicker({
				onSelect: onSelect,
				dateFormat: 'yy/mm/dd',
				yearSuffix: '年',
				showMonthAfterYear: true,
				isRTL: false,
				monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
				dayNames: ['日', '月', '火', '水', '木', '金', '土'],
				dayNamesMin: ['日', '月', '火', '水', '木', '金', '土']
			});
			that.prev('input').datepicker('show');
		}
	};

}());

/*
 * jQuery UI Monthpicker
 *
 * @licensed MIT <see below>
 * @licensed GPL <see below>
 *
 * @author Luciano Costa
 * http://lucianocosta.info/jquery.mtz.monthpicker/
 *
 * Depends:
 *  jquery.ui.core.js
 */

/**
 * MIT License
 * Copyright (c) 2011, Luciano Costa
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * GPL LIcense
 * Copyright (c) 2011, Luciano Costa
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

;(function ($) {

    var methods = {
        init : function (options) {
            return this.each(function () {
                var
                    $this = $(this),
                    data = $this.data('monthpicker'),
                    year = (options && options.year) ? options.year : (new Date()).getFullYear(),
                    settings = $.extend({
                        pattern: 'mm/yyyy',
                        selectedMonth: null,
                        selectedMonthName: '',
                        selectedYear: year,
                        startYear: year - 10,
                        finalYear: year + 10,
                        monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        id: "monthpicker_" + (Math.random() * Math.random()).toString().replace('.', ''),
                        openOnFocus: true,
                        disabledMonths: []
                    }, options);

                settings.dateSeparator = settings.pattern.replace(/(mmm|mm|m|yyyy|yy|y)/ig,'');

                // If the plugin hasn't been initialized yet for this element
                if (!data) {

                    $(this).data('monthpicker', {
                        'target': $this,
                        'settings': settings
                    });

                    if (settings.openOnFocus === true) {
                        $this.on('focus', function () {
                            $this.monthpicker('show');
                        });
                    }

                    $this.monthpicker('parseInputValue', settings);

                    $this.monthpicker('mountWidget', settings);

                    $this.on('monthpicker-click-month', function (e, month, year) {
                        $this.monthpicker('setValue', settings);
                        $this.monthpicker('hide');
                    });

                    // hide widget when user clicks elsewhere on page
                    $this.addClass("mtz-monthpicker-widgetcontainer");
                    $(document).unbind("mousedown.mtzmonthpicker").on("mousedown.mtzmonthpicker", function (e) {
                        if (!e.target.className || e.target.className.toString().indexOf('mtz-monthpicker') < 0) {
                            $(this).monthpicker('hideAll');
                        }
                    });
                }
            });
        },

        show: function () {
            $(this).monthpicker('hideAll');
            var widget = $('#' + this.data('monthpicker').settings.id);
            widget.css("top", this.offset().top  + this.outerHeight());
            if ($(window).width() > (widget.width() + this.offset().left) ){
                widget.css("left", this.offset().left);
            } else {
                widget.css("left", this.offset().left - widget.width());
            }
            widget.show();
            widget.find('select').focus();
            this.trigger('monthpicker-show');
        },

        hide: function () {
            var widget = $('#' + this.data('monthpicker').settings.id);
            if (widget.is(':visible')) {
                widget.hide();
                this.trigger('monthpicker-hide');
            }
        },

        hideAll: function () {
            $(".mtz-monthpicker-widgetcontainer").each(function () {
                if (typeof($(this).data("monthpicker"))!="undefined") {
                    $(this).monthpicker('hide');
                }
            });
        },

        setValue: function (settings) {
            var
                month = settings.selectedMonth,
                year = settings.selectedYear;

            if(settings.pattern.indexOf('mmm') >= 0) {
                month = settings.selectedMonthName;
            } else if(settings.pattern.indexOf('mm') >= 0 && settings.selectedMonth < 10) {
                month = '0' + settings.selectedMonth;
            }

            if(settings.pattern.indexOf('yyyy') < 0) {
                year = year.toString().substr(2,2);
            }

            if (settings.pattern.indexOf('y') > settings.pattern.indexOf(settings.dateSeparator)) {
                this.val(month + settings.dateSeparator + year);
            } else {
                this.val(year + settings.dateSeparator + month);
            }

            this.change();
        },

        disableMonths: function (months) {
            var
                settings = this.data('monthpicker').settings,
                container = $('#' + settings.id);

            settings.disabledMonths = months;

            container.find('.mtz-monthpicker-month').each(function () {
                var m = parseInt($(this).data('month'));
                if ($.inArray(m, months) >= 0) {
                    $(this).addClass('ui-state-disabled');
                } else {
                    $(this).removeClass('ui-state-disabled');
                }
            });
        },

        mountWidget: function (settings) {
            var
                monthpicker = this,
                container = $('<div id="'+ settings.id +'" class="ui-datepicker ui-widget ui-widget-content ui-helper-clearfix ui-corner-all" />'),
                header = $('<div class="ui-datepicker-header ui-widget-header ui-helper-clearfix ui-corner-all mtz-monthpicker" />'),
                combo = $('<select class="mtz-monthpicker mtz-monthpicker-year" />'),
                table = $('<table class="mtz-monthpicker" />'),
                tbody = $('<tbody class="mtz-monthpicker" />'),
                tr = $('<tr class="mtz-monthpicker" />'),
                td = '',
                selectedYear = settings.selectedYear,
                option = null,
                attrSelectedYear = $(this).data('selected-year'),
                attrStartYear = $(this).data('start-year'),
                attrFinalYear = $(this).data('final-year');

            if (attrSelectedYear) {
                settings.selectedYear = attrSelectedYear;
            }

            if (attrStartYear) {
                settings.startYear = attrStartYear;
            }

            if (attrFinalYear) {
                settings.finalYear = attrFinalYear;
            }

            container.css({
                position:'absolute',
                zIndex:999999,
                whiteSpace:'nowrap',
                width:'250px',
                overflow:'hidden',
                textAlign:'center',
                display:'none',
                top: monthpicker.offset().top + monthpicker.outerHeight(),
                left: monthpicker.offset().left
            });

            combo.on('change', function () {
                var months = $(this).parent().parent().find('td[data-month]');
                months.removeClass('ui-state-active');
                if ($(this).val() == settings.selectedYear) {
                    months.filter('td[data-month='+ settings.selectedMonth +']').addClass('ui-state-active');
                }
                monthpicker.trigger('monthpicker-change-year', $(this).val());
            });

            // mount years combo
            for (var i = settings.startYear; i <= settings.finalYear; i++) {
                var option = $('<option class="mtz-monthpicker" />').attr('value', i).append(i);
                if (settings.selectedYear == i) {
                    option.attr('selected', 'selected');
                }
                combo.append(option);
            }
            header.append(combo).appendTo(container);

            // mount months table
            for (var i=1; i<=12; i++) {
                td = $('<td class="ui-state-default mtz-monthpicker mtz-monthpicker-month" style="padding:5px;cursor:default;" />').attr('data-month',i);
                if (settings.selectedMonth == i) {
                   td.addClass('ui-state-active');
                }
                td.append(settings.monthNames[i-1]);
                tr.append(td).appendTo(tbody);
                if (i % 3 === 0) {
                    tr = $('<tr class="mtz-monthpicker" />');
                }
            }

            tbody.find('.mtz-monthpicker-month').on('click', function () {
                var m = parseInt($(this).data('month'));
                if ($.inArray(m, settings.disabledMonths) < 0 ) {
                    settings.selectedYear = $(this).closest('.ui-datepicker').find('.mtz-monthpicker-year').first().val();
                    settings.selectedMonth = $(this).data('month');
                    settings.selectedMonthName = $(this).text();
                    monthpicker.trigger('monthpicker-click-month', $(this).data('month'));
                    $(this).closest('table').find('.ui-state-active').removeClass('ui-state-active');
                    $(this).addClass('ui-state-active');
                }
            });

            table.append(tbody).appendTo(container);

            container.appendTo('body');
        },

        destroy: function () {
            return this.each(function () {
                $(this).removeClass('mtz-monthpicker-widgetcontainer').unbind('focus').removeData('monthpicker');
            });
        },

        getDate: function () {
            var settings = this.data('monthpicker').settings;
            if (settings.selectedMonth && settings.selectedYear) {
                return new Date(settings.selectedYear, settings.selectedMonth -1);
            } else {
                return null;
            }
        },

        parseInputValue: function (settings) {
            if (this.val()) {
                if (settings.dateSeparator) {
                    var val = this.val().toString().split(settings.dateSeparator);
                    if (settings.pattern.indexOf('m') === 0) {
                        settings.selectedMonth = val[0];
                        settings.selectedYear = val[1];
                    } else {
                        settings.selectedMonth = val[1];
                        settings.selectedYear = val[0];
                    }
                }
            }
        }

    };

    $.fn.monthpicker = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call( arguments, 1 ));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.mtz.monthpicker');
        }
    };

})(jQuery);
