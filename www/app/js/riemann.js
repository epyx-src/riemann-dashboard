
function RiemannService() {
	this._all_events = {};//this.get_cached_data();
	this._all_hosts = {};
	this.last_call = null;
	this.TIMEOUT_RELOAD = 1000 * 60 * 5;
	this.live_id = 0;
	this.live_list = [];
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
	var old_data = this._all_events[data.host+":"+data.service];
	var by_hosts = this._all_hosts[data.host] || {};
	by_hosts[data.service] = data;
	this._all_hosts[data.host] = by_hosts;
	this._all_events[data.host+":"+data.service] = data;
	if (!old_data || old_data.state != data.state || old_data.metric != old_data.metric) {
		this.notify_live(data.host, data.service, data);
	}
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

RiemannService.prototype.all_services = function(service_regexp) {
	var result = {};
	_.each(this._all_events, function(v, k) {
		if (v.service.match(service_regexp)) {
			result[k] = v
		}
	});
	return result;
};

RiemannService.prototype.all_hosts = function() {
	var result = {};
	_.each(this._all_hosts, function(v, k) {
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
	$.each(this.all_events, function(i, data) {
		self.notify_live(data.host, data.service, data);
	});
};

RiemannService.prototype.get = function(host, service) {
	service = service.replace(/\./g," ");
	return this._all_events[host+":"+service] || {};
};

RiemannService.prototype._live_key = function(host, service) {
	return host+":"+service;
};

RiemannService.prototype.add_live = function(host, service, fun, user_data) {
	this.live_id += 1;
	this.live_list.push({
		host: host,
		service: service.replace(/\./g," "),
		id: this.live_id,
		fun: fun,
		user_data: user_data
	});
	return this.live_id;
};

RiemannService.prototype.remove_live = function(id) {
	var self = this;
	$.each( this.live_list, function(i, obj) {
		if (obj.id == id) {
			delete self.live_list[i]
		}
	});
};

RiemannService.prototype.notify_live = function(host, service, riemann_data) {
	$.each( this.live_list, function(i, obj) {
		if (obj.host == host && obj.service == service) {
			(function(obj, data) {
				setTimeout(function() {
					try {
						obj.fun(data, obj.user_data);
					} catch(ex) {
						console.log("Error:" + ex);
					}
				}, 1);
			})(obj, riemann_data);
		}
	});
};

