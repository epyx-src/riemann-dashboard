$(function() {
	var show_error = function(text) {
		$("#main_error").append(
			'<div class="alert alert-warning alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button><strong>Error!</strong> '+text+'</div>'
		)
	}
	if (!!window.EventSource) {
  		var source = new EventSource('http://185.19.28.17:5558/index?query=true');
		source.addEventListener('message', function(e) {
			var data = JSON.parse(e.data);
		  	console.log(data);
		}, false);

		source.addEventListener('open', function(e) {
		 	console.log("SSE Open")
		}, false);

		source.addEventListener('error', function(e, err) {
		  	if (e.readyState == EventSource.CLOSED) {
				console.log("SSE Closed")
		  	} else {
				show_error("Server Send Event error")
				console.log("SSE error ", e, err)
			}
		}, false);
	} else {
	  	show_error("SSE not available")
	}

	var columns = ['cpu', 'memory'];

	var on_init = function() {
		$("#main_content").append('<table class="table"><tbody></tbody></table>')

	}

	var on_sse = function(data) {
		var $cell = $("tr#"+data.host);
		if (!$cell.length) {
			$cell = $('<tr id="'+data.host+'"')
		}
	}
});