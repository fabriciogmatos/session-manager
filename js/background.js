////////////////////////////////////////////////////////////////////////////////
// Analytics
////////////////////////////////////////////////////////////////////////////////

$(document).ready(function() {
$("#reset-session").change(function() {
    if($(this).is(':checked')) {
      setTimeout(function() {
        $('#reset-session').prop('checked', false);
      }, 1000);
      localStorage.sessions = "{}";
      chrome.storage.local.set({'sessions': JSON.stringify(sessions)});
    }
});
});

var version = chrome.runtime.getManifest().version;
localStorage = chrome.storage.local.get('sessions');
localStorage.version = function() { var version = chrome.runtime.getManifest().version};


////////////////////////////////////////////////////////////////////////////////
// Setup
////////////////////////////////////////////////////////////////////////////////
localStorage = chrome.storage.local.get('sessions', function(data) {
  var sessions = localStorage.sessions || '{}';
  var pinned = localStorage.pinned || "skip";
  var version = localStorage.version = chrome.runtime.getManifest().version;
  var open = localStorage.open || JSON.stringify({
	add: "click",
	replace: "shift+click",
	new: "ctrl/cmd+click",
	incognito: "alt+click",
});
  chrome.storage.local.set({'sessions': JSON.stringify(sessions)});
});

if (localStorage.version === version) {
	if (localStorage.temp) {
		JSON.parse(localStorage.temp).forEach(function (v) {
			chrome.tabs.create({ url: v });
		});

		delete localStorage.temp;

	}
} else {
	localStorage.readchanges = false;
	localStorage.version = version;
}


////////////////////////////////////////////////////////////////////////////////
// Omnibox
////////////////////////////////////////////////////////////////////////////////
chrome.omnibox.onInputChanged.addListener(function (text, suggest) {
	var sessions = JSON.parse(localStorage.sessions);
	text = text.trim();
	var ltext = text.toLowerCase();
	var suggestions = [];
	var indexes = {};

	if (text.length) {
		chrome.omnibox.setDefaultSuggestion({
			description: "Open <match>" + text + "</match>" + (sessions[text] ? "" : " ...") + " in this window"
		});

		Object.keys(sessions).forEach(function (name) {
			var index = name.toLowerCase().indexOf(ltext);

			if (index !== -1) {
				var match = "<match>" + name.slice(index, index + text.length) + "</match>";

				suggestions.push({
					content: name,
					description: name.slice(0, index) + match + name.slice(index + text.length)
				});

				indexes[name] = index;
			}
		});

		suggestions.sort(function (a, b) {
			return indexes[a.content] === indexes[b.content]
				? (a.content.length === b.content.length ? 0 : a.content.length - b.content.length)
				: indexes[a.content] - indexes[b.content];
		});

		suggest(suggestions);
	} else {
		chrome.omnibox.setDefaultSuggestion({ description: "Open a session in this window" });
	}
});

chrome.omnibox.onInputEntered.addListener(function (name) {
	var sessions = JSON.parse(localStorage.sessions);

	if (sessions[name]) {
		openSession(undefined, sessions[name]);
	}
});

chrome.omnibox.setDefaultSuggestion({ description: "Open a session in this window" });


////////////////////////////////////////////////////////////////////////////////
// Opening
////////////////////////////////////////////////////////////////////////////////
window.openSession = function (cwinId, urls, e, isTemp) {
	var open = JSON.parse(localStorage.open);
	var action = e ? (((e.ctrlKey || e.metaKey) && "ctrl/cmd+click") || (e.shiftKey && "shift+click") || (e.altKey && "alt+click") || "click") : open.add;

	for (var k in open) {
		if (action === open[k]) {
			action = k;
			break;
		}
	}

	if (action === "add") {
		urls.forEach(function (v) {
			chrome.tabs.create({ windowId: cwinId, url: v });
		});
	} else if (action === "replace") {
		chrome.tabs.getAllInWindow(cwinId, function (tabs) {
			openSession(cwinId, urls);

			if (localStorage.noreplacingpinned) {
				tabs = tabs.filter(function (t) { return !t.pinned; });
			}

			tabs.forEach(function (tab) {
				chrome.tabs.remove(tab.id);
			});
		});
	} else if (action === "new" || action === "incognito") {
		chrome.windows.create({ url: urls.shift(), incognito: action === "incognito" }, function (win) {
			openSession(win.id, urls);
		});
	} else {
		return false;
	}
};
