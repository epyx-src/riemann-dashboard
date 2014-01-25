var dashboardApp = angular.module('RiemannDashboardApp', ['ui.bootstrap']);


var percent_format = function(val) {
	return (val.metric * 100.0).toFixed(2) +"%"
};

var state_format = function(val) {
	if (val.state == 'ok') {
		return '<span class="glyphicon glyphicon-ok"></span>';
	}
	return val.state.toUpperCase()
};

var int_format = function(val) {
	return val.metric.toFixed(0)
};

var unit_format = function(unit, fixed) {
	return function(val) {
		return val.metric.toFixed(fixed) +" "+ unit
	}
};

var desc_format = function(val) {
	return "<span>"+val.description+"</span>";
};

var memory_format = function(val) {
	var lines = val.description.split("\n");
	var elms = _.map(lines, function(l) {
		return "<div>"+l+"</div>"
	});
	return elms.join("");
};

dashboardApp.controller('RiemannDashboardCtrl', function ($scope, $sce) {
	var service_info = {
		'test state': {
			format: state_format
		},
		'cpu': {
			img:"services",
			format: percent_format,
			graph: true
		},
		'memory': {
			img: "memory",
			format: percent_format,
			graph: true
		},
		'disk /': {
			img: "hdd",
			format: percent_format
		},
		'nginx*': {
			key: "ningx",
			name: "nginx",
			img: "www",
			format: state_format,
			state_key: "nginx health",
			values: {
				"nginx accepted": {
					name: "Accepted",
					format: int_format,
				},
				"nginx active": {
					name: "Active",
					format: int_format,
					graph: true
				},
				"nginx handled": {
					name: "Handled",
					format: int_format,
				},
				"nginx reading": {
					name: "Read",
					format: int_format,
					graph: true
				},
				"nginx requests": {
					name: "Req",
					format: int_format,
				},
				"nginx waiting": {
					name: "Wait",
					format: int_format,
					graph: true
				},
				"nginx writing": {
					name: "Write",
					format: int_format,
					graph: true
				}
			}
		},
		'riak*': {
			key: "riak2",
			name: "Riak",
			values: "all",
			img: "cloud-storage",
			state_key: "riak",
			values: {
				"riak disk": {
					format: unit_format("GB",2)
				},
				"riak node_gets": {
					graph: true,
					format: unit_format("/s",4)
				},
				"riak node_puts": {
					graph: true,
					format: unit_format("/s",4)
				},
				"riak read_repairs": {
					graph: true,
					format: unit_format("/s",4)
				},
				'riak ring': {
					img: "heart",
					format: state_format,
					name: "Riak ring"
				}
			}
		},
		'exodoc*': {
			key: "exodoc",
			name: "exodoc",
			img: "document",
			values: {
				"exodoc active users": {
					name: "Users",
					format: int_format
				},
				"exodoc documents": {
					name: "Docs",
					format: int_format
				},
				"exodoc documents waiting": {
					name: "Transform",
					format: int_format
				},
				"exodoc files": {
					name: "Files",
					format: int_format
				}
			}
		}
	};
	var services = _.map(service_info, function(v, k) {
		return v.key || k;
	});
	var max_history = 150;
	var max_history_sub = 30;
	$scope.available_services = services;
	$scope.dashboard = {};
	$scope.error = "";
	$scope.td_style = {width: '100%'};

	// handles the callback from the received event
 	var handleCallback = function (msg) {
		try {
			var data = JSON.parse(msg.data);
		} catch (ex) {
			console.error(ex,msg);
			showError(ex);
			setTimeout(function() {
				location.reload();
			});
			return;
		}
		var found_service = null;
		found_service = service_info[data.service];
		if (!found_service) {
			var main_service = data.service.split(" ")[0];
			found_service = service_info[main_service+"*"]
		}
		if (!found_service) {
			return;
		}
		$scope.$apply(function () {
			var ser_key = found_service.key || data.service;
			var host = $scope.dashboard[data.host] || {};
			var cell = host[ser_key] || {};
			handle_cell(cell, found_service, data);
			cell['desc'] = data.description;
			cell['host'] = data.host;


			host[ser_key] = cell;
			$scope.dashboard[data.host] = host;
			$scope.td_style = {width: (100/ _.keys($scope.dashboard).length)+"%"};
		});
 	};

	/**
	 * Store history data in local browser store
	 */
	var get_storage_history = function(host, service) {
		if (!!window.localStorage) {
			var key = "riemann.dashboard:"+host+":"+service;
			var history = window.localStorage.getItem(key) || "[]";

			var data = JSON.parse(history);
			return _.filter(data, function(v) {
				return (v != null)
			});
		}
		return [];
	};

	/**
	 * Get history data from local browser store
	 */
	var set_storage_history = function(host, service, history) {
		if (!!window.localStorage) {
			var key = "riemann.dashboard:"+host+":"+service;
			window.localStorage.setItem(key, JSON.stringify(history));
		}
	}

	var handle_cell = function(cell, cell_info, cell_data, is_sub) {
		var name = cell_info.name;
		if (!name) {
			name = cell_data.service
			if (is_sub) {
				var i = name.indexOf(" ");
				name = name.substring(i+1)
			}
		}
		cell['name'] = name;
		if (cell_info.state_key) {
			if (cell_info.state_key == cell_data.service) {
				cell['state'] = cell_data.state;
			}
		} else {
			cell['state'] = cell_data.state;
		}
		cell['classes'] = "img-"+cell_info.img+" state-"+cell['state'];
		if (cell['state'] == 'critical') {
			cell['classes'] += " animated pulse"
		} else if (cell['state'] == 'warning') {
			cell['classes'] += " animated bounce"
		}
		cell['history'] = cell['history'] || get_storage_history(cell_data.host, cell_data.service);
		cell['history'].push(cell_data.metric);
		var max = is_sub?max_history_sub:max_history;
		if (cell['history'].length > max) {
			cell['history'].splice(0, (cell['history'].length - max));
		}
		set_storage_history(cell_data.host, cell_data.service, cell['history']);
		var format_fun = cell_info.format || function(v) {return v.metric.toFixed(4);};
		try {
			cell['value'] = $sce.trustAsHtml(format_fun(cell_data));
		} catch (ex) {
			cell['value'] = "?"
		}
		if (cell_info.graph) {
			cell['sparklines'] = _.map(cell['history'], function(val, i) {
				return i+":"+val;
			}).join(",");
		}
		if (cell_info.values && cell_data.service != cell_info.state_key) {
			cell['values'] = cell['values'] || {};
			var val_info = cell_info.values[cell_data.service] || {};
			var sub_cell = cell['values'][cell_data.service] || {};

			handle_cell(sub_cell, val_info, cell_data, true);
			cell['values'][cell_data.service] = sub_cell;
		}
	};

	var showError = function(text) {
		$scope.error = text
	};

	var connect_sse = function() {
		if (!!window.EventSource) {
			console.log("Connecting to events");
			var source = new EventSource(window.SSE_URL+"?query=true");
			source.addEventListener('message', handleCallback, false);

			source.addEventListener('open', function(e) {
				console.log("Connected");
				$("body").css("background-color", "");
			}, false);

			source.addEventListener('error', function(e, err) {
				$("body").css("background-color", "red");
				console.error("SSE error", e);
				setTimeout(connect_sse, 10000);
				try {
					source.close();
				} catch (ex) {
					console.error(ex);
				}
			}, false);
			// Code to generate an event on startup ( for testing )
			/*
			setTimeout(function() {
				handleCallback({
					data: JSON.stringify({
						host:'test',
						service:'test state',
						state:'ok',
						metric:1
					})
				})
			});
			*/
		} else {
			showError("SSE not available")
		}
	};
	setTimeout(connect_sse);
});


dashboardApp.directive("sparkline", function() {
    return {
        restrict:"E",
        scope:{
            data:"@"
        },
        //template: "<div class='tpl'></div>",
        compile: function(tElement, tAttrs, transclude){
            tElement.replaceWith("<span>"+tAttrs.data+"</span>");
            return function(scope, element, attrs){
                attrs.$observe("data", function(newValue){
                    element.html(newValue);
                    element.sparkline('html',{
						type:'line',
						lineColor:'#aaf',
						fillColor: 'rgba(255,255,255,0.2)'
					});
                });
            };
        }
    };
});

dashboardApp.directive("riemanncell", function() {
    return {
        restrict:"E",
        scope:{
            data:"=data"
        },
        templateUrl: 'app/partials/riemanncell.html'
    };
});
