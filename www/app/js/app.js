function number_fixed(x, d) {
    if (!d) return x.toFixed(d); // don't go wrong if no decimal
    return x.toFixed(d).replace(/\.?0+$/, '');
}

var percent_format = function(val) {
	return number_fixed((val * 100.0), 0)
};

var FORMATS = {
	"percent": 	percent_format,
	"fixed-0":  function(val) {return number_fixed(val,0);},
	"fixed-1":  function(val) {return number_fixed(val,1);},
	"fixed-2":  function(val) {return number_fixed(val,2);}
};

var apply_format = function(val, format) {
	if (val == undefined) {
		return "";
	}
	var fun = FORMATS[format] || function(val) {return val;};
	return fun(val);
};

/* Application */
var dashboardApp = angular.module('ExodocDashboardApp', ['ui.bootstrap']);

dashboardApp.factory('RiemannService', function() {
  	var service = new RiemannService();
	service.start();
  	return service;
});

dashboardApp.controller('ExodocDashboardCtrl',['$scope', '$interval', 'RiemannService', function($scope, $interval, riemann_service) {
	$scope.all_events = {};
	$interval(function() {
		$scope.all_events = riemann_service.all_events()
	}, 2000)
}]);


var find_host = function(tElement, tAttrs) {
	var host = tAttrs.host;
	if (host == undefined) {
		var elm = tElement.closest("[host-group]");
		if (elm.length) {
			host = elm.attr("host-group")
		}
	}
	if (!host) {
		throw "Missing host value for element " + tElement;
	}
	return host;
}

/**
 * Display easy pie on a given service
 */
dashboardApp.directive("rmEasyPie", ['$interval', 'RiemannService', function($interval, riemann_service) {
	var id_count = 0;
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var service = tAttrs.service;
			var host = find_host(tElement, tAttrs);
			var interval = parseInt(tAttrs.interval || "1000");
			var unit = tAttrs.unit || "";
			var size = tAttrs.size || 110;
			tElement.replaceWith('<div id="easy-pie-'+(id_count++)+'" class="rm-easy-pie-chart" data-percent="0"><span>0</span>'+unit+'</div>');
			return function(scope, element, attrs){
				var timeout_id = null;
				var old_metric = null;
				var old_state = null;
				var bar_color = "rgba(200,255,220,0.5)";
				var bat_color_fun = function() {
					return bar_color;
				};

				var options = {
					animate: 2000,
					size: size,
					trackColor: "rgba(0,0,0,0.5)",
					barColor: bat_color_fun,
					lineWidth: (size / 15)
				};
				$(element).easyPieChart(options);
				$(element).find("span").css("line-height", size+"px");
				$(element).css("font-size", (size/6)+"px");
				$(element).css("width",size+"px");
				function update() {
					var date = riemann_service.get(host, service);
					var metric = date.metric;
					var state = date.state;
					if (old_metric != metric) {
						$(element).data('easyPieChart').update(metric * 100);
						$(element).find("span").text(
							percent_format(metric)
						);
						old_metric = metric
					}
					if (old_state != state) {
						if (state == 'warning') {
							bar_color = "rgba(255,100,100, 0.8)";
						} else if (state == 'critical') {
							bar_color = "rgba(200,180,100, 0.8)";
						} else if (state == 'ok') {
							bar_color = "rgba(200,255,220,0.5)";
						} else {
							bar_color = "rgba(255,255,255, 0.2)";
						}
						old_state = state;
					}
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
			};
		}
	};
}]);

/**
 * jquery sparkline angular integration
 */
dashboardApp.directive("rmSparkline", ['$interval', 'RiemannService', function($interval, riemann_service) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var service = tAttrs.service;
			var host = find_host(tElement, tAttrs);
			var interval = parseInt(tAttrs.interval || "2000");
			var nb_elements = parseInt(tAttrs.nb_elements || "100");
			var min = tAttrs.min;
			var max = tAttrs.max;
			var height = parseInt(tAttrs.height || "16");
			var title = tAttrs.title || "";
			var show_value = tAttrs.showValue || false;
			var unit = tAttrs.unit || ""
			tElement.replaceWith('<div class="rm-sparklines"><div class="graph"></div><span class="value">&nbsp;</span><br><span class="title">'+title+'</span></div>');
			return function(scope, element, attrs){
				var timeout_id = null;
				var datas = [];
				function update() {
					var metric = riemann_service.get(host, service).metric || 0;
					datas.push(metric);
					if (datas.length > nb_elements) {
						datas.shift();
					}
					var options = {
						type:'line',
						lineColor:'rgba(255,255,255,0.5)',
						fillColor: 'rgba(255,255,255,0.1)',
						minSpotColor: false,
						maxSpotColor: false,
						spotColor: 'white',
						height: height
					};
					$(element).find("span.value").css({
						"line-height": (height/2)+"px",
						"font-size": (height/2)+"px"
					});
					$(element).find("span.title").css({
						"line-height": (height/3)+"px",
						"font-size": (height/3.5)+"px"
					});
					if (min != undefined) {
						options['chartRangeMin'] = parseFloat(min);
					}
					if (max != undefined) {
						options['chartRangeMax'] = parseFloat(max);
					}
					$(element).find(".graph").sparkline(datas,options);
					if (show_value) {
						$(element).find("span.value").text(
							apply_format(metric, show_value) + "" + unit
						)
					}
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
			};
		}
	};
}]);

/**
 * jquery progress bar angular integration
 */
dashboardApp.directive("rmProgress", ['$interval', 'RiemannService', function($interval, riemann_service) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var service = tAttrs.service;
			var host = find_host(tElement, tAttrs);
			var interval = parseInt(tAttrs.interval || "10000");
			var max = tAttrs.max;
			tElement.replaceWith('<div class="progress progress-small"><div class="progress-bar progress-bar-primary"></div></div>');
			return function(scope, element, attrs){
				var timeout_id = null;
				var old_metric = [];
				function update() {
					var metric = riemann_service.get(host, service).metric;
					var real_max = 100;
					if ((""+max).indexOf("metric:") == 0) {
						real_max = riemann_service.get(host, max.substring(7)).metric || 100;
					} else if (max) {
						real_max = parseInt(""+max)
					}
					if (old_metric != metric) {
						var width = ((metric * 100) / real_max);
						$(element).find(".progress-bar").css("width",width);
						old_metric = metric;
					}
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
				setTimeout(function() {
					update();
				},1000);
			};
		}
	};
}]);

/**
 * display metric updated every interval
 */
dashboardApp.directive("rmLiveMetric", ['$interval', 'RiemannService', function($interval, riemann_service) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var service = tAttrs.service;
			var host = find_host(tElement, tAttrs);
			var interval = parseInt(tAttrs.interval || "1000");
			var format = tAttrs.format
			return function(scope, element, attrs){
				var timeout_id = null;
				var old_metric = null;
				function update() {
					var metric = riemann_service.get(host, service).metric || 0;
					if (old_metric != metric) {
						element.text(
							apply_format(metric, format)
						);
						old_metric = metric
					}
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
			};
		}
	};
}]);

/**
 * display status of a given riemann metric
 */
dashboardApp.directive("rmState", ['$interval', 'RiemannService', function($interval, riemann_service) {
	return {
        restrict:"A",
		compile: function(tElement, tAttrs, transclude){
			var service = tAttrs.service || tAttrs.rmState;
			var host = find_host(tElement, tAttrs);
			var interval = parseInt(tAttrs.interval || "1000");
			return function(scope, element, attrs){
				var timeout_id = null;
				var old_state = null;
				function update() {
					var riemann_data = riemann_service.get(host, service);
					if (riemann_data == undefined) {
						element.text( "unknwon: "+host+"/"+service);
						return;
					}
					var state = riemann_data.state;
					if (!state) {
						state = "critical"
					}
					if (old_state != state) {
						element.removeClass("rm-state-"+old_state);
						element.addClass("rm-state-"+state);
						if (state == 'critical') {
							element.addClass("animated pulse")
						} else if (state == 'warning') {
							element.addClass("animated bounce")
						} else {
							element.removeClass("animated bounce pulse")
						}
						old_state = state;
					}
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
			};
		}
	};
}]);

/**
 * display graphite graph updated every interval
 */
dashboardApp.directive("rmGraphite", ['$interval', function($interval) {
	var create_graphite_url = function(host, series, options) {
		options = _.extend(options, {
			bgcolor: "#000000",
			fgcolor: "#999999",
			minorGridLineColor: "#555555",
			majorGridLineColor: "#888888",
			areaMode: 'first',
			fontBold: 'false',
			areaAlpha: "0.8",
			_uniq: (1 / Math.floor((new Date()).getTime() / 30000.0))
		});
		var query = $.param(options);
		var colors = [];
		_.each(series, function(data){
			colors.push(data.color || "green");
			query = query + "&" + $.param({
				target: host+"."+data.target.replace(/ /g,".").replace(/[//]/, "")
			});
		});
		query = query + "&" + $.param({
			colorList: colors.join(",")
		});
		return window.GRAPHITE_URL + "?" + query;
	};
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var host = find_host(tElement, tAttrs);
			var series = [];
			var from = tAttrs.from || "-24hours";
			var until = tAttrs.until || "now";
			var interval = parseInt(tAttrs.interval || "60000");
			var height = tAttrs.height;
			var width = tAttrs.width;

			/* Grab additional attribute and use them as is in graphit parameters */
			var ATTRIBUTES = [
				"title", "yMax", "yMin", "hideLegend",
				"hideYAxis"
			];
			var graph_options = {};
			_.each(ATTRIBUTES, function(v) {
				if (tAttrs[v] != undefined) {
					graph_options[v] = tAttrs[v];
				}
			});

			tElement.find("serie").each(function() {
				var $elm = $(this);
				series.push({
					target: $elm.attr("service") || "",
					color: $elm.attr("color")
				});
			});
			if (tAttrs.series) {
				_.each(tAttrs.series.split(","), function(serie) {
					var vals = serie.split(":");
					var data = {
						target: vals[0] || ""
					};
					if (vals.length > 1) {
						data.color = vals[1];
					}
					series.push(data)
				});
			}
			tElement.replaceWith('<div class="graphite-graph" style="width:100%;display: block;"><img src=""></div>');
			return function(scope, element, attrs){
				var timeout_id = null;
				function update() {
					var options = _.extend({
						from: from,
						until: until
					}, graph_options);

					if ( height != undefined) {
						options['height'] = height;
					} else {
						options['height'] = element.height();
					}
					if ( width != undefined) {
						options['width'] = width;
					} else {
						options['width'] = element.width();
					}
					var graphite_url = create_graphite_url(host, series, options);
					element.find("img").attr("src", graphite_url);
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update DOM
      			}, interval);
				setTimeout(function() {
					update();
				}, 1000);
			};
		}
	};
}]);


/**
 * display pizza pie chart
 */

dashboardApp.directive("rmDonut", ['$interval', 'RiemannService', function($interval, riemann_service) {
	var id_counter = 0;
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var host = find_host(tElement, tAttrs);
			var title = tAttrs.title || "";
			var interval = parseInt(tAttrs.interval || "100000");
			var height = tAttrs.height;
			var id = "pizza-"+(id_counter++);
			var $chart = $('<div id="'+id+'">');
			if (height != undefined) {
				$chart.css("height", height);
			}
			var series = [];
			tElement.find("part").each(function(i, elm) {
				var $elm = $(elm);
				series.push({
					target: $elm.attr("target").replace(/\./g, " "),
					label: $elm.text(),
					color: $elm.attr("color"),
					count: $elm.attr("count")
				});
			});
			tElement.replaceWith($chart);
			var data = _.map(series, function(v) {
				return [
					v.label + (v.count?"&nbsp;<span style='float:right; color:rgba(0,0,0,0.7)'>--</span>":""),
					0
				];
			});
			var colors = _.map(series, function(v, k) {
				return v.color || $.jqplot.config.defaultColors[k]
			});
			var plot = jQuery.jqplot(id, [data], {
				seriesDefaults: {
					renderer: jQuery.jqplot.DonutRenderer,
					rendererOptions: {
						sliceMargin: 1,
						showDataLabels: true
					},
					shadow: false,
					showLine: true
				},
				seriesColors: colors,
				legend: { show:true, location: 'e' },
				grid: {
					background: "transparent",
					borderWidth: 0,
					shadow: false
				},
				title: title
			});
			return function(scope, element, attrs){
				var timeout_id = null;
				function update() {
					data = _.map(series, function(v) {
						var metric = riemann_service.get(host, v.target).metric || 0;
						return [
							v.label + (v.count?"&nbsp;<span style='float:right; color:rgba(0,0,0,0.7)'>"+metric+"</span>":""),
							metric
						];
					});
					plot.series[0].data = data;
					plot.replot();
      			}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
					plot.destroy();
      			});
				timeout_id = $interval(function() {
        			update(); // update plot
      			}, interval);
				setTimeout(function() {
					update();
				}, 1000);

			};
		}
	};
}]);


/* display a clock */
dashboardApp.directive("rmFlipClock", ['$interval', function($interval) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var interval = parseInt(tAttrs.interval || "1000");
			return function(scope, element, attrs){
				var timeout_id = null;
				function digit(x) {
					return (x < 10)?"0"+x:x;
				}
				function update() {
					var d = new Date();
					element.text(
						digit(d.getHours())+":"+ digit(d.getMinutes())+":"+ digit(d.getSeconds())
					)
				}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
      			});
				timeout_id = $interval(function() {
        			update(); // update plot
      			}, interval);
			};
		}
	};
}]);

/* Legend display */
dashboardApp.directive("rmLegend", ['$interval', function($interval) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			return tElement.replaceWith('<div class="rm-legend"><span class="color" style="background-color:'+tAttrs.color+';"></span> <span class="title">'+tElement.text()+'</span>');
		}
	};
}]);