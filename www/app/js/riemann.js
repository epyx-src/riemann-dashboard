function RiemannService() {
	this._all_events = this.get_cached_data()
}

RiemannService.prototype.handle_error = function(err, stop) {
	console.error(err);
	if (stop) {
		$("body").css("background", "red");
	}
	this.reconnect_sse()
};

var last_call = null;
RiemannService.prototype.handle_callback = function(msg) {
	try {
		var data = JSON.parse(msg.data);
		var now = new Date();
		if (!last_call || last_call.getMinutes() != now.getMinutes()) {
			console.log("Received ", now);
			last_call = now;
		}
	} catch (ex) {
		this.handle_error(ex);
		return;
	}
	this._all_events[data.host+":"+data.service] = data;

};

RiemannService.prototype.all_events = function() {
	var result = {};
	_.each(this._all_events, function(v, k) {
		result[k] = v;
	});
	return result;
};

RiemannService.prototype.reconnect_sse = function() {
	var self = this;
	try {
		this.source.close();
	} catch (ex) {
		console.error(ex);
	}
	this.source = null;
	setTimeout(function() {
		self.connect_sse();
	}, 1000);
};

RiemannService.prototype.connect_sse = function() {
	var self = this;
	if (!!window.EventSource) {
		console.log("Riemann service connecting to events");
		self.source = new EventSource(window.SSE_URL+"?query=true");
		self.source.addEventListener('message', function(msg) {
			self.handle_callback(msg)
		}, false);

		self.source.addEventListener('open', function(e) {
			console.log("Riemann service connected");
		}, false);

		self.source.addEventListener('error', function(e, err) {
			self.handle_error(err);
		}, false);
	} else {
		this.handle_error("SSE not available", true)
	}
};

RiemannService.prototype.get_cached_data = function() {
	if (!!window.localStorage) {
		try {
			var key = "exodoc.services";
			var data = window.localStorage.getItem(key) || "{}";
			return JSON.parse(data);
		} catch (ex) {
			console.error(ex);
		}
	}
	return {};
};

RiemannService.prototype.update_cached_data = function() {
	if (!!window.localStorage) {
		var key = "exodoc.services";
		window.localStorage.setItem(key, JSON.stringify(self._all_events));
		console.log("Data cached")
	}
};

RiemannService.prototype.start = function() {
	var self = this;
	console.log("Riemann service starting");
	this.connect_sse();
	setInterval(function() {
		self.update_cached_data()
	}, 60000)
};

RiemannService.prototype.get = function(host, service) {
	service = service.replace(/\./g," ");
	return this._all_events[host+":"+service] || {};
};