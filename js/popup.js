(function(){ "use strict";

/*** utils ***/
var utils = {
	view: function(name){
		$("body").children().hide();
		$("#" + name).show();
	},
	confirm: function(html, index){
		var yes = $("#confirm-text").html(html).siblings().children().eq(0).attr("data-actionindex", typeof index === "number" ? index : 1);
		utils.view("confirm");
		yes.focus();
	},
	action: function(name, index){
        var $seaa = $("#main-search-name").val().trim();
        //alert(name, index);
        if (name == "search") {
            console.log("ação: search");
            var $txt = $("#main-search-name").val().trim();
            console.log("Variável de pesquisa: "+ $txt);
            if ($txt !="") {
                console.log("Entrou");
                //alert($("#main-search-name").val().trim());
                let alvo = document.getElementById("main-saved-list");
                alvo.innerText = "";
                console.log("Limpou as divs");
                sessions.sc();
                console.log("sessions.sc();");
            } else {
                state.action = name || state.action;
                actions[state.action][index || 0](state.name);
                sessions.load();
            }
        } else {
            state.action = name || state.action;
            actions[state.action][index || 0](state.name);
            sessions.load();
        }
	},
	escape: function(text){
		return $("<div/>").text(text).html();
	},
	tabs: function(cb){
		chrome.tabs.getAllInWindow(null, function(tabs){
			if (localStorage.pinned === "skip") {
				tabs = tabs.filter(function(t){ return !t.pinned; });
			}
			
			cb(tabs.map(function(t){ return t.url; }));
			sessions.load();
		});
	}
};


/*** data ***/
var background = chrome.extension.getBackgroundPage();

var state = {
	name: "",
	action: "",
	entered: ""
};

var sessions = {
	list: JSON.parse(localStorage.sessions),
	temp: localStorage.temp ? JSON.parse(localStorage.temp) : undefined,
	
	load: function(){
		var $temp = $("#main-saved-temp"), $list = $("#main-saved-list");
		$temp.add($list).empty();
		
		if (sessions.temp) {
			localStorage.temp = JSON.stringify(sessions.temp);
			$temp.html("<a>&times;</a> Temp session: " + sessions.display(null, true) + " - <a>Open</a> - <a>Add</a> (<a>tab</a>)<hr>");
		} else {
			delete localStorage.temp;
		}
		
		localStorage.sessions = JSON.stringify(sessions.list);
		$.each(sessions.list, function(name){
			$("<div/>").html("<big>" + utils.escape(name) +' ' + "</big><a>&times;</a><br>" +
				sessions.display(name, true) +
				"<span><a>Open</a> - <a>Add</a> (<a>tab</a>) - <a>Replace</a></span>" +
			"<br><hr>").attr("data-name", name).appendTo($list);
		});
		
		$("hr", "#main-saved").last().remove();
		
		$list.children().css("margin-right", Object.keys(sessions.list).length > 10 ? 5 : 0);
	},
    sc: function(name){
		
        var $list = $("#main-saved-list");
		
		localStorage.sessions = JSON.stringify(sessions.list);
		
        $.each(sessions.list, function(name){
            var $str = utils.escape(name);
            var $txt = $("#main-search-name").val().trim();
            var $str = $str.toUpperCase();
        
            console.log($str, name, $txt);
            
            if ($str.includes($txt.toUpperCase()) ) {
                $("<div/>").html("<big>" + utils.escape(name) + "</big><a>&times;</a><br>" +
                    sessions.display(name, true) +
                    "<span><a>Open</a> - <a>Add</a> (<a>tab</a>) - <a>Replace</a></span>" +
                "<br><hr>").attr("data-name", name).appendTo($list);
            }
		});
		$("#main-search-name").val("");
		$("hr", "#main-saved").last().remove();
		
		$list.children().css("margin-right", Object.keys(sessions.list).length > 10 ? 5 : 0);
	},
	display: function(name, count){
		var prefix = "", session = name === null ? (name = "temp session", !count && (prefix = "the "), sessions.temp) : sessions.list[name];
		return prefix + '<a title="' + session.join("\n") + '">' + (count ? session.length + " tabs" : utils.escape(name)) + '</a>';
	}
};


/*** actions ***/
var actions = {
	import: [function(){
		var reader = new FileReader();
		
		reader.onload = function(e){
			try {
				$.each(JSON.parse(e.target.result), function(name, urls){
					sessions.list[name] = urls;
				});
				
				state.entered = "Success";
			} catch (e) {
				state.entered = "ParseError";
			}
			
			utils.action("import", 1);
		};
		
		reader.onerror = function(){
			state.entered = "FileError";
			utils.action("import", 1);
		};
		
		reader.readAsText($("#import-file")[0].files[0]);
	}, function(){
		var status = state.entered,
			success = status === "Success",
			message = $("#import-message").text(success ? "Success!" : "Import failed!").delay(500).slideDown();
		
		success && message.delay(1500).queue(function(next){
			location.search ? window.close() : utils.view("main");
			message.hide();
			next();
		});
		
		// background.ga("send", "event", "Action", "Import", state.entered);
	}],
	
	export: [function(){
		var data = new Blob([localStorage.sessions]);
		
		$("#export-link").prop("href", (window.URL || window.webkitURL).createObjectURL(data));
	}, function(){
		$("#export-check").fadeIn().delay(2000).fadeOut();
		
		// background.ga("send", "event", "Action", "Export");
	}],
	
	rename: [function(name){
		$("#rename-legend").html("Rename " + sessions.display(name));
		utils.view("rename");
		$("#rename-text").val("").focus();
	}, function(oname){
		var nname = state.entered = $("#rename-text").val().trim();
		
		if (nname) {
			if (sessions.list[nname]) {
				utils.confirm("Are you sure you want to replace " + sessions.display(nname) + " by renaming " + sessions.display(oname) + "?", 2);
			} else {
				utils.action("rename", 2);
				utils.view("main");
			}
		}
	}, function(oname){
		sessions.list[state.entered] = sessions.list[oname];
		
		if (state.entered !== oname) {
			delete sessions.list[oname];
		}
		
		// background.ga("send", "event", "Session", "Rename");
	}],
	
	add: [function(name){
		utils.confirm("Are you sure you want to add the current window's tabs to " + sessions.display(name) + "?");
	}, function(name){
		utils.tabs(function(tabs){
			Array.prototype.push.apply(name === null ? sessions.temp : sessions.list[name], tabs);
		});
		
		// background.ga("send", "event", name === null ? "Temp": "Session", "AddWin");
	}],
	
	tab: [function(name){
		utils.confirm("Are you sure you want to add the current tab to " + sessions.display(name) + "?");
	}, function(name){
		chrome.tabs.getSelected(null, function(tab){
			(name === null ? sessions.temp : sessions.list[name]).push(tab.url);
			sessions.load();
		});
		
		// background.ga("send", "event", name === null ? "Temp": "Session", "AddTab");
	}],
	
	replace: [function(name){
		utils.confirm("Are you sure you want to replace " + sessions.display(name) + " with the current window's tabs?");
	}, function(name){
		// background.ga("send", "event", "Session", sessions.list[name] ? "Replace" : "Save");
		
		utils.tabs(function(tabs){
			sessions.list[name] = tabs;
		});
	}, function(name){
		utils.confirm("Are you sure you want to replace " + sessions.display(name) + " with the session being saved?");
	}],
	
	remove: [function(name){
		utils.confirm("Are you sure you want to remove " + sessions.display(name) + "?");
	}, function(name){
		if (name === null) {
			delete sessions.temp;
		} else {
			delete sessions.list[name];
		}
		
		// background.ga("send", "event", name === null ? "Temp" : "Session", "Remove");
	}],
	
	savetemp: [function(){
		utils.tabs(function(tabs){
			sessions.temp = tabs;
		});
		
		// background.ga("send", "event", "Temp", "Save");
	}],
 
//     // save all windows and tabs
//     saveall: [function(){
// // 		utils.tabs(function(tabs){
// // 			sessions.temp = tabs;
// // 		});
//         chrome.windows.getAll(true);
// 	}],
  
    search: [function(){
        var $name = $("#main-search-name"), name = state.name = $name.val().trim();
        
        if (name==" ") {
            exit;
        } else {
            var $clear = $("#main-saved-list");
            var $list = $("#main-saved-list"), name = state.name = $name.val().trim();
            let alvo = document.getElementById("main-saved-list");
            alvo.innerText = "";
            
            const div = document.getElementById("main-saved-list");
        
            for (child of div.children){
                child.remove();
            }
        }
        //document.write("popup.html");
      
        /*$.each(sessions.list, function(name){
			$("<div/>").html("<big>" + utils.escape(name) +' ' + "</big><a>&times;</a><br>" +
				sessions.display(name, true) +
				"<span><a>Open</a> - <a>Add</a> (<a>tab</a>) - <a>Replace</a></span>" +
			"<br><hr>").attr("data-name", name).appendTo($list);
		*/
        
        //});
        //alert(name);
        //utils.view("main");
        //utils.view("main");
        //document.write(list);
        //sessions.sc(name);
        //sessions.load();
        
        //sessions.display(name);
        //sessions.load;
        //document.write("");
    return name;
	}],
	
    
//     search: [function(){
// 		utils.tabs(function(tabs){
// 			sessions.temp = tabs;
// 		});
//         utils.tabs(function(tabs){
//                         sessions.list[name] = tabs;
//                     });
// :
// 		
// 		// background.ga("send", "event", "Temp", "Save");
// 	}],
    all: [function(){
		var $name = $("#main-save-name"), name = state.name = $name.val().trim();
		
		if (name) {
			$name.val("");
			
			utils.action("replace", sessions.list[name] ? 2 : 1);
		}
	}],
// 	
	save: [function(){
		var $name = $("#main-save-name"), name = state.name = $name.val().trim();
		
		if (name) {
			$name.val("");
			
			utils.action("replace", sessions.list[name] ? 2 : 1);
		}
	}]
};


/*** events ***/
$("body").on("focus", "*", function(){
	this.blur();
	
	$("body").off("focus", "*");
}).on("click keypress", "[data-view], [data-action]", function(e){
	if ((this.tagName === "BUTTON" && e.type === "keypress") || (this.tagName === "INPUT" && (e.type !== "keypress" || e.which !== 13))) {
		return;
	}
	
	"view" in this.dataset && utils.view(this.dataset.view);
	"action" in this.dataset && utils.action(this.dataset.action, this.dataset.actionindex);
});


//---------------------
$("#main-search-list").on("click", "big, div > a:not([title])", function(){
	state.name = this.parentNode.dataset.name;
	
	utils.action(this.tagName === "BIG" ? "rename" : "remove");
}).on("click", "span > a", function(e){
	var action = this.textContent.toLowerCase(),
		name = state.name = this.parentNode.parentNode.dataset.name;
	
	if (action === "open") {
		chrome.windows.getCurrent(function(win){
			background.openSession(win.id, sessions.list[name], e, false) !== false && window.close();
		});
	} else {
		utils.action(action);
	}
});

//_------------------------------

$("#main-saved-list").on("click", "big, div > a:not([title])", function(){
	state.name = this.parentNode.dataset.name;
	
	utils.action(this.tagName === "BIG" ? "rename" : "remove");
}).on("click", "span > a", function(e){
	var action = this.textContent.toLowerCase(),
		name = state.name = this.parentNode.parentNode.dataset.name;
	
	if (action === "open") {
		chrome.windows.getCurrent(function(win){
			background.openSession(win.id, sessions.list[name], e, false) !== false && window.close();
		});
	} else {
		utils.action(action);
	}
});

$("#main-saved-temp").on("click", "a:not([title])", function(e){
	var action = this.textContent.toLowerCase();
	state.name = null;
	
	if (action === "open") {
		chrome.windows.getCurrent(function(win){
			background.openSession(win.id, sessions.temp, e, true) !== false && window.close();
		});
	} else if (action.length === 1) {
		utils.action("remove");
	} else {
		utils.action(action);
	}
});

$("#import-file").change(function(){
	utils.action("import");
});


/*** init ***/
sessions.load();

if (localStorage.readchanges !== "true") {
	$("#main-changelog").show();
	
	localStorage.readchanges = true;
}

if (location.search) {
	$("#import [data-view]").click(function(){
		window.close();
		
		return false;
	});
	
	utils.view("import");
	
	// background.ga("send", "pageview", "/import");
} else {
	// background.ga("send", "pageview", "/popup");
}

})();
document.getElementById("main-search-name").focus();
$("#main-search-name").focus();
