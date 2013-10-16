// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd.
// MIT License. See license.txt 

/* Inspired from: http://github.com/mindmup/bootstrap-wysiwyg */

// todo 
// onsave, oncancel

wn.provide("wn.ui");
wn.ui.Editor = Class.extend({
	init: function(editor, options) {
		var me = this;
		this.editor = $(editor);
		this.options = $.extend(options || {}, this.default_options);
		
		this.editor.on("click", function() {
			if(!this.editing) {
				me.make();
				me.editor.attr('contenteditable', true);
				me.original_html =  me.editor.html();
				wn._editor_toolbar.show();
				wn._editor_toolbar.editor = me.editor.focus();
				me.editing = true;
			}
		}).on("mouseup keyup mouseout", function() {
			if(me.editing) {
				wn._editor_toolbar.save_selection();
				wn._editor_toolbar.update();
			}
		}).on("blur", function() {
			if(!wn._editor_toolbar.clicked || wn._editor_toolbar.clicked.parents(".wn-ignore-click").length) {
				return false;
			}
			wn._editor_toolbar.toolbar.find("[data-action='Save']").trigger("click");
		}).data("object", this);

		this.bind_hotkeys();
		this.init_file_drops();
	},
	make: function() {
		if(!wn._editor_toolbar) {
			wn._editor_toolbar = new wn.ui.EditorToolbar(this.options)
		}
	},
	onhide: function(action) {
		this.editing = false;
		if(action==="Cancel") {
			this.editor.html(this.original_html);
			this.options.oncancel && this.options.oncancel(this);
		} else {
			this.options.onsave && this.options.onsave(this);
		}
	},
	default_options: {
		hotKeys: {
			'ctrl+b meta+b': 'bold',
			'ctrl+i meta+i': 'italic',
			'ctrl+u meta+u': 'underline',
			'ctrl+z meta+z': 'undo',
			'ctrl+y meta+y meta+shift+z': 'redo',
			'ctrl+l meta+l': 'justifyleft',
			'ctrl+e meta+e': 'justifycenter',
			'ctrl+j meta+j': 'justifyfull',
			'shift+tab': 'outdent',
			'tab': 'indent'
	    },
		toolbar_selector: '[data-role=editor-toolbar]',
		command_role: 'edit',
		active_toolbar_class: 'btn-info',
		selection_marker: 'edit-focus-marker',
		selection_color: 'darkgrey',
		remove_typography: true,
		max_file_size: 1,
	},
	
	bind_hotkeys: function () {
		var me = this;
		$.each(this.options.hotKeys, function (hotkey, command) {
			me.editor.keydown(hotkey, function (e) {
				if (me.editor.attr('contenteditable') && me.editor.is(':visible')) {
					e.preventDefault();
					e.stopPropagation();
					wn._editor_toolbar.execCommand(command);
				}
			}).keyup(hotkey, function (e) {
				if (me.editor.attr('contenteditable') && me.editor.is(':visible')) {
					e.preventDefault();
					e.stopPropagation();
				}
			});
		});
	},

	clean_html: function() {
		var html = this.editor.html() || "";
		html = html.replace(/(<br>|\s|<div><br><\/div>|&nbsp;)*$/, '');

		// remove custom typography (use CSS!)
		if(this.options.remove_typography) {
			html = html.replace(/(font-family|font-size|line-height):[^;]*;/g, '');
			html = html.replace(/<[^>]*(font=['"][^'"]*['"])>/g, function(a,b) { return a.replace(b, ''); });
			html = html.replace(/\s*style\s*=\s*["']\s*["']/g, '');
			return html;
		}
	},	
	
	init_file_drops: function () {
		var me = this;
		this.editor.on('dragenter dragover', false)
			.on('drop', function (e) {
				var dataTransfer = e.originalEvent.dataTransfer;
				e.stopPropagation();
				e.preventDefault();
				if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
					me.insert_files(dataTransfer.files);
				}
			});
	},
	
	insert_files: function (files) {
		var me = this;
		this.editor.focus();
		$.each(files, function (i, file) {
			if (/^image\//.test(file.type)) {
				me.get_image(file, function(image_url) {
					wn._editor_toolbar.execCommand('insertimage', image_url);
				})
			}
		});
	},

	get_image: function (fileobj, callback) {
		var freader = new FileReader(),
			me = this;

		freader.onload = function() {
			var dataurl = freader.result;
			// add filename to dataurl
			var parts = dataurl.split(",");
			parts[0] += ";filename=" + fileobj.name;
			dataurl = parts[0] + ',' + parts[1];
			if(me.options.max_file_size) {
				if(dataurl.length > (me.options.max_file_size * 1024 * 1024 * 1.4)) {
					wn.msgprint("Max file size (" + me.options.max_file_size + "M) exceeded.");
					throw "file size exceeded";
				}
			}
			callback(dataurl);
		}
		freader.readAsDataURL(fileobj);
	}
	
})

wn.ui.EditorToolbar = Class.extend({
	init: function(options) {
		this.options = options;
		this.options.toolbar_style = $.extend(this.options.toolbar_style || {}, this.style);
		this.make();
		this.toolbar = $(".wn-editor-toolbar").css(this.options.toolbar_style);
		this.overlay_image_button();
		this.bind_events();
		this.bind_touch();

		var me = this;
		$(document).mousedown(function(e) {
			me.clicked = $(e.target);
	    });
	},
	style: {
		position: "fixed",
		top: "0px",
		padding: "5px",
		width: "100%",
		height: "45px",
		"background-color": "#777"
	},
	make: function() {
		if(!$(".wn-editor-toolbar").length) {
			$('<div class="wn-editor-toolbar wn-ignore-click">\
			<div class="btn-toolbar container" data-role="editor-toolbar" style="margin-bottom: 7px;">\
				<div class="btn-group form-group">\
					<a class="btn btn-default btn-small dropdown-toggle" data-toggle="dropdown" \
						title="Font Size"><i class="icon-text-height"></i> <b class="caret"></b></a>\
					<ul class="dropdown-menu">\
						<li><a data-edit="formatBlock &lt;p&gt;"><p>Paragraph</p></a></li>\
						<li><a data-edit="formatBlock &lt;h1&gt;"><h1>Heading 1</h1></a></li>\
						<li><a data-edit="formatBlock &lt;h2&gt;"><h2>Heading 2</h2></a></li>\
						<li><a data-edit="formatBlock &lt;h3&gt;"><h3>Heading 3</h3></a></li>\
						<li><a data-edit="formatBlock &lt;h4&gt;"><h4>Heading 4</h4></a></li>\
						<li><a data-edit="formatBlock &lt;h5&gt;"><h5>Heading 5</h5></a></li>\
					</ul>\
				</div>\
				<div class="btn-group form-group">\
					<a class="btn btn-default btn-small" data-edit="bold" title="Bold (Ctrl/Cmd+B)">\
						<i class="icon-bold"></i></a>\
					<a class="btn btn-default btn-small" data-edit="insertunorderedlist" title="Bullet list">\
						<i class="icon-list-ul"></i></a>\
					<a class="btn btn-default btn-small" data-edit="insertorderedlist" title="Number list">\
						<i class="icon-list-ol"></i></a>\
					<a class="btn btn-default btn-small" data-edit="outdent" title="Reduce indent (Shift+Tab)">\
						<i class="icon-indent-left"></i></a>\
					<a class="btn btn-default btn-small" data-edit="indent" title="Indent (Tab)">\
						<i class="icon-indent-right"></i></a>\
				</div>\
				<div class="btn-group hidden-xs form-group">\
					<a class="btn btn-default btn-small" data-edit="justifyleft" title="Align Left (Ctrl/Cmd+L)">\
						<i class="icon-align-left"></i></a>\
					<a class="btn btn-default btn-small" data-edit="justifycenter" title="Center (Ctrl/Cmd+E)">\
						<i class="icon-align-center"></i></a>\
					<a class="btn btn-default btn-small btn-add-link" title="Insert Link">\
						<i class="icon-link"></i></a>\
					<a class="btn btn-default btn-small" title="Remove Link" data-edit="unlink">\
						<i class="icon-unlink"></i></a>\
					<a class="btn btn-default btn-small" title="Insert picture (or just drag & drop)">\
						<i class="icon-picture"></i></a>\
					<input type="file" data-role="magic-overlay" data-edit="insertImage" />\
					<a class="btn btn-default btn-small" data-edit="insertHorizontalRule" \
						title="Horizontal Line Break">-</a>\
				</div>\
				<div class="btn-group form-group">\
					<a class="btn btn-default btn-small btn-html" title="HTML">\
						<i class="icon-wrench"></i></a>\
					<a class="btn btn-default btn-small btn-html" data-action="Cancel" title="Cancel">\
						<i class="icon-remove"></i></a>\
					<a class="btn btn-default btn-small btn-success" data-action="Save" title="Save">\
						<i class="icon-save"></i></a>\
				</div>\
			</div>').prependTo("body");
		}
	},
	
	overlay_image_button: function() {
		// magic-overlay
		this.toolbar.find('[data-role=magic-overlay]').each(function () { 
			var overlay = $(this), target=overlay.prev();
			overlay.css('opacity', 0).css('position', 'absolute')
				.css("left", 155)
				.width(38).height(33);
		});
	},
	
	show: function() {
		var me = this;
		this.toolbar.toggle(true);
		$("body").animate({"padding-top": this.toolbar.outerHeight() }, {
			complete: function() { 	me.toolbar.css("z-index", 1001); }
		});
	},

	hide: function(action) {
		var me = this;
		this.toolbar.css("z-index", 0);
		$("body").animate({"padding-top": 0 }, {complete: function() {
			me.toolbar.toggle(false);
		}});
		
		this.editor && this.editor.attr('contenteditable', false).data("object").onhide(action);
		this.editor = null;
	},
	
	bind_events: function () {
		var me = this;
				
		// standard button events
		this.toolbar.find('a[data-' + me.options.command_role + ']').click(function () {
			me.restore_selection();
			me.editor.focus();
			me.execCommand($(this).data(me.options.command_role));
			me.save_selection();
			return false;
		});
		this.toolbar.find('[data-toggle=dropdown]').click(function() { me.restore_selection() });

		// link
		this.toolbar.find(".btn-add-link").on("click", function() {
			if(!wn._link_editor) {
				wn._link_editor = new wn.ui.LinkEditor();
			}
			wn._link_editor.show();
		})
		
		// file event
		this.toolbar.find('input[type=file][data-' + me.options.command_role + ']').change(function () {
			me.restore_selection();
			if (this.type === 'file' && this.files && this.files.length > 0) {
				me.editor.data("object").insert_files(this.files);
			}
			me.save_selection();
			this.value = '';
			return false;
		});
		
		// save
		this.toolbar.find("[data-action='Save']").on("click", function() {
			me.hide("Save");
		})

		// cancel
		this.toolbar.find("[data-action='Cancel']").on("click", function() {
			me.hide("Cancel");
		})
		
		// edit html
		this.toolbar.find(".btn-html").on("click", function() {
			if(!wn._html_editor)
				wn._html_editor = new wn.ui.HTMLEditor();
			
			wn._html_editor.show(me.editor);
		})
	},

	update: function () {
		var me = this;
		if (this.options.active_toolbar_class) {
			$(this.options.toolbar_selector).find('.btn[data-' + this.options.command_role + ']').each(function () {
				var command = $(this).data(me.options.command_role);
				if (document.queryCommandState(command)) {
					$(this).addClass(me.options.active_toolbar_class);
				} else {
					$(this).removeClass(me.options.active_toolbar_class);
				}
			});
		}
	},
	
	execCommand: function (commandWithArgs, valueArg) {
		var commandArr = commandWithArgs.split(' '),
			command = commandArr.shift(),
			args = commandArr.join(' ') + (valueArg || '');
		document.execCommand(command, 0, args);
		this.update();
	},
	
	get_current_range: function () {
		var sel = window.getSelection();
		if (sel.getRangeAt && sel.rangeCount) {
			return sel.getRangeAt(0);
		}
	},
	
	save_selection: function () {
		this.selected_range = this.get_current_range();
		this.selected_html = this.get_current_html();
	},
	
	get_current_html: function() {
	    var html = "";
	    if (typeof window.getSelection != "undefined") {
	        var sel = window.getSelection();
	        if (sel.rangeCount) {
	            var container = document.createElement("div");
	            for (var i = 0, len = sel.rangeCount; i < len; ++i) {
	                container.appendChild(sel.getRangeAt(i).cloneContents());
	            }
	            html = container.innerHTML;
	        }
	    } else if (typeof document.selection != "undefined") {
	        if (document.selection.type == "Text") {
	            html = document.selection.createRange().htmlText;
	        }
	    }
	    return html;
	},
	
	restore_selection: function () {
		var selection = window.getSelection();
		if (this.selected_range) {
			selection.removeAllRanges();
			selection.addRange(this.selected_range);
		}
	},
	
	mark_selection: function (input, color) {
		this.restore_selection();
		document.execCommand('hiliteColor', 0, color || 'transparent');
		this.save_selection();
		input.data(this.options.selection_marker, color);
	},
	
	bind_touch: function() {
		var me = this;
		$(window).bind('touchend', function (e) {
			var isInside = (me.editor.is(e.target) || me.editor.has(e.target).length > 0),
				current_range = me.get_current_range(),
				clear = current_range && (current_range.startContainer === current_range.endContainer && current_range.startOffset === current_range.endOffset);
			if (!clear || isInside) {
				me.save_selection();
				me.update();
			}
		});
	}
});

wn.ui.HTMLEditor = Class.extend({
	init: function() {
		var me = this;
		this.modal = wn.get_modal("Edit HTML", '<textarea class="form-control" \
			style="height: 400px; width: 100%; font-family: Monaco, Courier New, Fixed; font-size: 11px">\
			</textarea><br>\
			<button class="btn btn-primary" style="margin-top: 7px;">Save</button>');
		this.modal.addClass("wn-ignore-click");
		this.modal.find(".btn-primary").on("click", function() {
			me.editor.html(me.modal.find("textarea").val());
			me.modal.modal("hide");
		});
	},
	show: function(editor) {
		var me = this;
		this.editor = editor;
		this.modal.modal("show")
		this.modal.find("textarea").html(html_beautify(me.editor.html()));
	}
});

wn.ui.LinkEditor = Class.extend({
	init: function() {
		var me = this;
		this.modal = wn.get_modal("Edit HTML", '<div class="form-group">\
				<input type="text" class="form-control" placeholder="http://example.com" />\
			</div>\
			<div class="checkbox" style="position: static;">\
				<label>\
				    <input type="checkbox"> <span>Open Link in a new Window</span>\
				</label>\
			</div>\
			<button class="btn btn-primary" style="margin-top: 7px;">Insert</button>');
		
		this.modal.addClass("wn-ignore-click");
		this.modal.find(".btn-primary").on("click", function() {
			wn._editor_toolbar.restore_selection();
			var url = me.modal.find("input[type=text]").val();
			var selection = wn._editor_toolbar.selected_range.toString();
			if(url) {
				if(me.modal.find("input[type=checkbox]:checked").length) {
					var html = "<a href='" + url + "' target='_blank'>" + selection + "</a>";
					document.execCommand("insertHTML", false, html);
				} else {
					document.execCommand("CreateLink", false, url);
				}
			}
			me.modal.modal("hide");
			return false;
		});
	},
	show: function() {
		this.modal.find("input[type=text]").val("");
		this.modal.modal("show");
	}
})