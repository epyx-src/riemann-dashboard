
function RiemannService() {
	this._all_events = this.get_cached_data();
	this.last_call = null;
	this.TIMEOUT_RELOAD = 1000 * 60 * 5;
}

RiemannService.prototype.handle_error = function(err, stop) {
	console.error(err);
	if (stop) {
		$("body").css("background", "red");
	}
	this.reconnect_sse()
};

RiemannService.prototype.handle_callback = function(msg) {
	try {
		var data = JSON.parse(msg.data);
		this.last_call = new Date();
	} catch (ex) {
		this.handle_error(ex);
		return;
	}
	this._all_events[data.host+":"+data.service] = data;

};

RiemannService.prototype.stop = function() {
	if (this._check_interval) {
		clearInterval(this._check_interval);
	}
	if (this._cache_interval) {
		clearInterval(this._cache_interval);
	}
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
	self.last_call = null;
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
	}
};

RiemannService.prototype.start = function() {
	var self = this;
	console.log("Riemann service starting");
	this.connect_sse();
	self._cache_interval = setInterval(function() {
		self.update_cached_data()
	}, 60000);
	self._check_interval = setInterval(function() {
		var now = new Date();
		if (self.last_call && (now - self.last_call) > self.TIMEOUT_RELOAD ) {
			self.reconnect_sse()
		}
	}, 1000);
};

RiemannService.prototype.get = function(host, service) {
	service = service.replace(/\./g," ");
	return this._all_events[host+":"+service] || {};
};