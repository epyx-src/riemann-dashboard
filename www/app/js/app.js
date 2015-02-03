function number_fixed(x, d) {
    if (!d) return x.toFixed(d); // don't go wrong if no decimal
    return x.toFixed(d).replace(/\.?0+$/, '');
}

var percent_format = function(val, precision) {
	return number_fixed((val * 100.0), precision?precision:0)
};

var humanFileSize = function(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if(bytes < thresh) return bytes + ' B';
    var units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(bytes >= thresh);
    return bytes.toFixed(1)+' '+units[u];
};

/**
 * Converts milliseconds to human readeable language.
 * X days XXh XXm
 */
function dhm(t){
    var cd = 24 * 60 * 60,
        ch = 60 * 60,
        d = Math.floor(t / cd),
        h = '0' + Math.floor( (t - d * cd) / ch),
        m = '0' + Math.round( (t - d * cd - h * ch) / 60);
	if (t < 60) {
		return "< 1m";
	}
	var result = m.substr(-2)+"m";
	if (h > 0) {
		result = h.substr(-2)+"h "+result
	}
	if (d > 0)  {
		result = d+"d "+result
	}
    return result;
}

var FORMATS = {
	"percent": percent_format,
	"percent-1":  function(val) {return percent_format(val,1);},
	"fixed-0":  function(val) {return number_fixed(val,0);},
	"fixed-1":  function(val) {return number_fixed(val,1);},
	"fixed-2":  function(val) {return number_fixed(val,2);},
	"file-size": function(val) {return humanFileSize(val, null);},
	"duration": function(val) {return dhm(val);}
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
  	return service;
});

dashboardApp.controller('ExodocDashboardCtrl',['$scope', '$interval', 'RiemannService', function($scope, $interval, riemann_service) {
	$scope.refresh = function() {
		location.reload();
	};
	$scope.status = {
		connected: false
	};
	$interval(function() {
		$scope.status.connected = riemann_service.connected;
	}, 5000);
	riemann_service.start();
}]);

dashboardApp.controller('ExodocMapdCtrl',['$scope', '$interval', 'RiemannService', function($scope, $interval, riemann_service) {
	$scope.refresh = function() {
		location.reload();
	};
	$scope.status = {
		connected: false
	};
	$interval(function() {
		$scope.status.connected = riemann_service.connected;
	}, 5000);
	riemann_service.start();
	$interval(function () {
         $scope.all_hosts = riemann_service.all_hosts();
		 //$scope.all_nginx = riemann_service.all_services(/^nginx active$/g);
		 //$scope.all_haproxy = riemann_service.all_services(/^haproxy .* FRONTEND req_rate$/g);
    }, 2000);
}]);


var find_host = function(tElement, tAttrs) {
	var host = tAttrs.host;
	if (host == undefined) {
		var elm = tElement.closest("[host]");
		if (elm.length) {
			host = elm.attr("host")
		}
	}
	if (!host) {
		throw "Missing host value for element " + tElement;
	}
	return host;
};

var find_interval =  function(tElement, tAttrs, default_value) {
	var interval = tAttrs.interval;
	if (interval == undefined) {
		var elm = tElement.closest("[interval]");
		if (elm.length) {
			interval = elm.attr("interval")
		}
	}
	if (interval == undefined) {
		interval = default_value || "1000";
	}
	var ret = null;
	if (isNaN(interval)) {
		ret = juration.parse(""+interval) * 1000;
	} else {
		ret = parseInt(interval);
	}
	return ret;
};

/**
 * monitoring with visjs
 */
dashboardApp.directive("visualmon", ['$interval', 'RiemannService', function($interval, riemannService) {
	var id_count = 0;
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var nodes = [];
			var edges = [];
			var elm_id = 0;
			var find_by_name = function(name) {
				return _.find(nodes, function(n) {
					return n.name == name;
				}) || _.find(edges, function(n) {
					return n.name == name;
				}) || {};
			};
			var find_by_id = function(id) {
				return _.find(nodes, function(n) {
					return n.id == id;
				}) || _.find(edges, function(n) {
					return n.id == id;
				}) || {};
			};
			tElement.find("node").each(function(i, n) {
				var node = $(n);
				data ={
					"id": (elm_id++),
					"type": "n",
					"name": node.attr("name"),
					"host": node.attr("host"),
					"status": node.attr("status"),
					"metric": node.attr("metric"),
					"format": node.attr("format"),
					"shape": node.attr("shape") || "box",
					"level": parseInt(node.attr("level")) || 0,
					"fontSize": 12,
					"fontFace": "arial",
					"color": {
						background: '#444',
					  	border: '#000',
						color: '#000'
					},
					fontColor: "#888"
				};
				var x = node.attr('x');
				var y = node.attr('y');
				var level = node.attr('level');

				if (x) {
					data.x = parseInt(x);
					data.allowedToMoveX = false;
				} else {
					data.x = 0;
				}
				if (y) {
					data.y = parseInt(y);
					data.allowedToMoveY = false;
				} else if (level != null) {
					data.y = parseInt(level) * 100.0;
				} else {
					data.y = 0;
				}
				data.label = (node.attr("label") || node.attr("name")).toUpperCase() + "\n["+data.host+"]";
				data._label = (node.attr("label") || node.attr("name")).toUpperCase() + "\n["+data.host+"]";
				nodes.push(data);
			});
			tElement.find("edge").each(function(i, n) {
				var node = $(n);
				data = {
					"id": (elm_id++),
					"type": "e",
					"from": find_by_name(node.attr("src")).id,
					"to": find_by_name(node.attr("dst")).id,
					"host": node.attr("host"),
					"color": {
						color: '#000'
					},
					"fontColor": '#000',
					"style": "arrow",
					"status": node.attr("status"),
					"metric": node.attr("metric"),
					"format": node.attr("format")
				};
				var length = node.attr('length');
				if (length) {
					data.length = parseInt(length);
				}
				edges.push(data);
			});
			var width = tAttrs.width || "400px";
			var height = tAttrs.height || "400px";
			var vis_id = 'visualmon-'+(id_count++);
			tElement.replaceWith('<div id="'+vis_id+'" class="visualmon">'+JSON.stringify(edges)+'</div>');

			// create a network
			var container = document.getElementById(vis_id);

			var dataset_nodes = new vis.DataSet();
			dataset_nodes.add(nodes);
			var dataset_edges = new vis.DataSet();
			dataset_edges.add(edges);

			var data = {
				nodes: dataset_nodes,
				edges: dataset_edges
			};
			var options = {
				width: width,
				height: height,
				zoomable: false,
				selectable: true,
				repulsion: {
				  enabled: false
			    },
				physics: {
					enable: false
				},
				smoothCurves: false,
				nodes: {
					fontFace: "Helvetica Neue"
				}

			};
			var network = new vis.Network(container, data, options);
			window.addEventListener("resize", function() {
				network.redraw();
				network.zoomExtent(false);
			});
			var all = [].concat(nodes, edges);
			_.each(all, function(n) {
				if (n.status) {
					riemannService.add_live(n.host, n.status, function (data, elm_id) {
						var node_or_edge = find_by_id(elm_id);
						if (data.state == 'ok') {
							node_or_edge.color.border = "#032c19";
							node_or_edge.color.background = "#075730";
							node_or_edge.fontColor = "#55d475";
							node_or_edge.color.color = "rgb(150,255,150)";
							node_or_edge.width = 2;
						} else if (data.state == 'warning') {
							node_or_edge.color.border = "orange";
							node_or_edge.color.background = "rgb(204, 175, 91)";
							node_or_edge.fontColor = "#2d270f";
							node_or_edge.color.color = "orange";
							node_or_edge.width = 2;
						} else if (data.state == 'critical') {
							node_or_edge.color.border = "white";
							node_or_edge.color.background = "rgb(204, 0, 0)";
							node_or_edge.fontColor = "white";
							node_or_edge.color.color = "red";
							node_or_edge.width = 2;
						} else {
							node_or_edge.color.border = "black";
							node_or_edge.color.background = "darkGrey";
							node_or_edge.fontColor = "gray";
							node_or_edge.color.color = "black";
							node_or_edge.width = 1;
						}
						if (node_or_edge.type == 'n') {
							dataset_nodes.update(node_or_edge)
						} else if (node_or_edge.type == 'e') {
							node_or_edge.fontColor = "yellow";
							node_or_edge.fontFill = "black";
							dataset_edges.update(node_or_edge)
						}
					}, n.id)
				}
				if (n.metric) {
					console.log("Add metric: "+n)
					riemannService.add_live(n.host, n.metric, function (data, elm_id) {
						var node_or_edge = find_by_id(elm_id);
						var val = apply_format(data.metric, node_or_edge.format);
						if (node_or_edge.type == 'n') {
							node_or_edge.label = node_or_edge._label + "\n(" + val+")";
							dataset_nodes.update(node_or_edge)
						} else if (node_or_edge.type == 'e') {
							node_or_edge.label = ""+val;
							dataset_edges.update(node_or_edge)
						}
					}, n.id)
				}
			});

			return function(scope, element, attrs){

			}
		}
	};
}]);

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
			var interval = find_interval(tElement, tAttrs, 3000);
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
					var r_data = riemann_service.get(host, service);
					var metric = r_data.metric;
					var state = r_data.state;
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
			var interval = find_interval(tElement, tAttrs, 3000);
			var nb_elements = parseInt(tAttrs.nb_elements || "100");
			var min = tAttrs.min;
			var max = tAttrs.max;
			var height = parseInt(tAttrs.height || "16");
			var title = tAttrs.title || "";
			var show_value = tAttrs.showValue || false;
			var unit = tAttrs.unit || "";
			tElement.replaceWith(
				'<div class="rm-sparklines"><div class="graph"></div><span class="value">&nbsp;</span><br><span class="title">'+title+'</span></div>'
			);
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
						height: height,
						disableInteraction: true,
						width: "100%"
					};
					$(element).find("span.value").css({
						"line-height": (height/2)+"px",
						"font-size": (height/2)+"px"
					});
					$(element).find("span.title").css({
						"line-height": (height/3)+"px",
						"font-size": (height/3.5)+"px"
					});
					$(element).css("height", height);
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
			var interval = find_interval(tElement, tAttrs, "10s");
			var max = tAttrs.max;
			tElement.replaceWith(
				'<div class="progress progress-alpha progress-small"><div class="progress-bar progress-bar-primary"></div></div>'
			);
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
			var interval = parseInt(tAttrs.interval || "3000");
			var format = tAttrs.format;
			tElement.replaceWith('<span class="live-metric"></span>');
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
			var interval = find_interval(tElement, tAttrs, "3s");
			var live = tAttrs.live || true;
			return function(scope, element, attrs){
				var timeout_id = null;
				var old_state = null;
				var live_id = null;
				function update(riemann_data) {
					riemann_data = riemann_data || riemann_service.get(host, service);
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
					if (timeout_id) {
						$interval.cancel(timeout_id);
					}
					if (live_id) {
						riemann_service.remove_live(live_id);
					}
      			});
				if (live) {
					live_id = riemann_service.add_live(host, service, function(riemann_data) {
						update(riemann_data); // update DOM
					});
				} else {
					timeout_id = $interval(function () {
						update(); // update DOM
					}, interval);
				}
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
			var interval = find_interval(tElement, tAttrs, "60s");
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
 * display a tendency ( up or down ) in percent of a given service
 * use graphite from and until to get boundaries.
 */
dashboardApp.directive("rmTendency", ['$interval', function($interval) {
	var create_graphite_url = function(host, service, from) {
		var graphite_target = host+"."+service.replace(/ /g,".").replace(/[//]/, "");
		var summarize = from.substring(1); // remove "-" from from
		var options = {
			_uniq: (1 / Math.floor((new Date()).getTime() / 30000.0)),
			format: "json",
			until: "now",
			from: from,
			target: 'summarize(derivative('+graphite_target+'), "'+summarize+'")'
		};
		var query = $.param(options);
		return window.GRAPHITE_URL + "?" + query;
	};
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var host = find_host(tElement, tAttrs);
			var service =  tAttrs.service;
			var from = tAttrs.from || "-24hours";
			var reversed = (tAttrs.reversed != undefined);
			var interval = find_interval(tElement, tAttrs, "60s");
			var $text = $('<span class="graphite-tendency-text"></span>');
			var $icon = $('<i class="glyphicon glyphicon-minus"></i>');
			tElement.replaceWith(
				$('<span class="graphite-tendency">').append(
					$text, $icon
				)
			);

			return function(scope, element, attrs){
				var timeout_id = null;

				function update() {
					var graphite_url = create_graphite_url(host, service, from);
					$.get(graphite_url, function(data) {
						if (data) {
							var points = data[0].datapoints;
							var value = points[points.length-1][0];
							element.removeClass(
								"graphite-tendency-up",
								"graphite-tendency-down",
								"graphite-tendency-bad",
								"graphite-tendency-good"
							);
							var text = ""+value;
							if (value > 0 ) {
								var cls = "graphite-tendency-"+(reversed?"bad":"good");
								element.addClass("graphite-tendency-up");
								element.addClass(cls);
								text = "+"+text
							} else if (value < 0 ) {
								var cls = "graphite-tendency-"+(reversed?"good":"bad");
								element.addClass("graphite-tendency-down");
								element.addClass(cls);
							}
							$text.text(text);
						} else {
							$text.text("-");
						}
					})
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
 * display a tendency ( up or down ) in percent of a given service
 * use graphite from and until to get boundaries.
 */
dashboardApp.directive("rmSummarize", ['$interval', function($interval) {
	var create_graphite_url = function(host, service, from, key) {
		var graphite_target = host+"."+service.replace(/ /g,".").replace(/[//]/, "");
		var summarize = from.substring(1); // remove "-" from from
		var options = {
			_uniq: (1 / Math.floor((new Date()).getTime() / 30000.0)),
			format: "json",
			until: "now",
			from: from,
			target: 'summarize('+graphite_target+', "'+summarize+'", "'+key+'")'
		};
		var query = $.param(options);
		return window.GRAPHITE_URL + "?" + query;
	};
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var host = find_host(tElement, tAttrs);
			var service =  tAttrs.service;
			// can be: sum, avg, max, min
			var key =  tAttrs.key || "max";
			var from = tAttrs.from || "-24hours";
			var interval = find_interval(tElement, tAttrs, "60s");
			var $text = $('<span class="graphite-text"></span>');
			tElement.replaceWith($text);
			return function(scope, element, attrs){
				var timeout_id = null;
				function update() {
					var graphite_url = create_graphite_url(host, service, from, key);
					$.get(graphite_url, function(data) {
						if (data) {
							var points = data[0].datapoints;
							var value = points[points.length-1][0];
							$text.text(value);
						} else {
							$text.text("No data");
						}
					})
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
 * display the last metric received in a given period of time
 * Use graphite to get value, not riemann
 */
dashboardApp.directive("rmLastMetric", ['$interval', function($interval) {
	var create_graphite_url = function(host, service, from) {
		var graphite_target = host+"."+service.replace(/ /g,".").replace(/[//]/, "");
		var options = {
			_uniq: (1 / Math.floor((new Date()).getTime() / 30000.0)),
			format: "json",
			until: "now",
			from: from,
			target: graphite_target
		};
		var query = $.param(options);
		return window.GRAPHITE_URL + "?" + query;
	};
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var host = find_host(tElement, tAttrs);
			var service =  tAttrs.service;
			var interval = find_interval(tElement, tAttrs, "60s");
			var from = tAttrs.from || "-24hours";
			var format = tAttrs.format || "";
			var showTime = tAttrs.showTime || false;
			var $text = $('<span class="live-last-metric"></span>');
			var $time = $('<span class="graphite-last-time"></span>');
			var $value = $('<span class="graphite-last-value"></span>');
			$text.append($value);
			$text.append($time);
			tElement.replaceWith($text);
			return function(scope, element, attrs){
				var timeout_id = null;
				function update() {
					var graphite_url = create_graphite_url(host, service, from);
					$.get(graphite_url, function(data) {
						if (data && data.length) {
							var when = "never";
							var value = 0;
							var val = _.find(data[0].datapoints.reverse(), function(val) {
								return val[0];
							});
							if (val) {
								when = dhm((new Date() - new Date(val[1]*1000)) / 1000);
								value = val[0];
							}
							if (format != undefined) {
								value = apply_format(value, format);
							}
							$value.text(value);
							if (showTime) {
								$time.text(when);
							}
						} else {
							$value.text("-");
							if (showTime) {
								$time.text("-");
							}
						}
					})
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
			var interval = find_interval(tElement, tAttrs, "10s");
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
					plot.series[0].data = _.map(series, function(v) {
						var metric = riemann_service.get(host, v.target).metric || 0;
						return [
							v.label + (v.count?"&nbsp;<span style='float:right; color:rgba(0,0,0,0.7)'>"+metric+"</span>":""),
							metric
						];
					});
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
			var interval = 1000;
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

/* Riemann live eval */
dashboardApp.directive("rmLive", ['$interval', 'RiemannService', function($interval, riemann_service) {
	return {
        restrict:"E",
		compile: function(tElement, tAttrs, transclude){
			var interval = find_interval(tElement, tAttrs, "3s");
			var script = $(tElement).text();
			var host = find_host(tElement, tAttrs);
			var format = tAttrs.format;
			script = "(function() { return "+script+"})()";
			tElement.replaceWith('<span class="live-metric"></span>');
			return function(scope, element, attrs){
				var timeout_id = null;
				function update() {
					var service = function(str) {
						return riemann_service.get(host, str);
					};
					var ret = "";
					try {
						ret = eval(script);
					} catch ( ex ) {
						ret = '<span class="label label-danger">'+ex+'</span>';
					}
					if (format != undefined) {
						ret = apply_format(ret, format);
					}
					$(element).html(ret);
				}
				element.on('$destroy', function() {
        			$interval.cancel(timeout_id);
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