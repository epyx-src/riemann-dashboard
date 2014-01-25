var dashboardApp = angular.module('RiemannDashboardApp', ['ui.bootstrap']);

var percent_format = function(val) {
	return (val.metric * 100.0).toFixed(2) +"%"
};

var state_format = function(val) {
	return val.state.toUpperCase()
};

var int_format = function(val) {
	return val.metric.toFixed(0)
};


dashboardApp.controller('RiemannDashboardCtrl', function ($scope) {
	var service_info = {
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
					graph: true
				},
				"nginx active": {
					name: "Active",
					format: int_format,
					graph: true
				},
				"nginx handled": {
					name: "Handled",
					format: int_format,
					graph: true
				},
				"nginx reading": {
					name: "Read",
					format: int_format,
					graph: true
				},
				"nginx requests": {
					name: "Req",
					format: int_format,
					graph: true
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
				"riak node_gets": {
					graph: true
				},
				"riak node_puts": {
					graph: true
				},
				"riak read_repairs": {
					graph: true
				}
			}
		},
		'riak ring': {
			img: "heart",
			format: state_format,
			name: "Riak ring"
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
			console.error(ex);
			showError(ex);
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
		cell['history'] = cell['history'] || [];
		cell['history'].push(cell_data.metric);
		var max = is_sub?max_history_sub:max_history;
		if (cell['history'].length > max) {
			cell['history'] = cell['history'].splice(0, cell['history'].length - max);
		}
		var format_fun = cell_info.format || function(v) {return v.metric.toFixed(4);};
		try {
			cell['value'] = format_fun(cell_data);
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

	if (!!window.EventSource) {
  		var source = new EventSource('http://185.19.28.17:5558/index?query=true');
		source.addEventListener('message', handleCallback, false);

		source.addEventListener('open', function(e) {
		 	console.log("SSE Open")
		}, false);

		source.addEventListener('error', function(e, err) {
		  	if (e.readyState == EventSource.CLOSED) {
				console.log("SSE Closed")
		  	} else {
				showError("Server Send Event error")
			}
		}, false);
	} else {
	  	showError("SSE not available")
	}
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
