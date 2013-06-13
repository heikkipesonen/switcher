/*
			infinite scroller
			Heikki Pesonen
			Metropolia university of applied sciences / ereading
			2013

			rotates between five divs in a loop, infinite number
			of items can be displayed. 

			When items-list runs out, the scroller will start scrolling
			from the beginning.

		
		!!	REQUIRES jquery.hammer for touch
			https://github.com/EightMedia/hammer.js

		callbacks:

			onchange: fired each time the middle pane changes
			dragend: when draggin of the scroller has ended
			ondrag: return pixel values while moving
			
			the middle (active) pane is returned as "this" for easy access
	
		options:
			
		!!	items: the set of items to be put inside panes,
				for example array of divs.. or images.. 
				html elements

				use onchange function for more complex actions and to
				change the divs content while changing pages
	
			tension: movement required to move the content to overcome the springback function,
					ratio of an paneWidth.
					tension value of 0.5 would require 200px move on a 400px wide container
					default 0.6 must be over 0.5
					if less than tension*width, element is sprung back into its original position.

			touches: required number of touches (fingers) to move the scroller,
					default = 1

			paneWidth: width of panes, either in percents or pixels (default: 40%)

		usage: 
			var MySwitcherObject = $('selector').switcher({
				onchange:function([new pane that became visible], [list index of the current middle pane] ){

					this = middle pane (the one on center of the screen)
					
					// do stuff
				},
				dragend:function(){
					// do stuff
				}
			});



			methods:
				
				MySwitcherObject.next();
				MySwitcherObject.prev();
				MySwitcherObject.goto( list item index ) -> will jump into the pane containing the item




		returns the switcher object
		which can be used from there on

		todo:
			scroll to certain list item, done, but needs adjustments
			inertia
*/



$.fn.extend({
	// returns translated RELATIVE position
	// because of reasons
	_getPosition:function(){
		return {
			top:parseFloat( this.attr('translate-y') ),
			left:parseFloat( this.attr('translate-x') ),
			unit:this.attr('translate-units')
		}
	},
	
	// makes functionality for each jquery element for translate command, prefixes are defined in prefix array
	// only translates in relative coordinates
	//
	// uses translate-y and translate-x attributes for returning the current position
	// also translate-units attribute is used, for easily read the units for translation,
	// for example px or %

	_translate:function(x,y,units){
		var prefix = ['moz','o','ms','webkit'];

		if (!units){
			units = 'px';
		}
		
		for (var i in prefix){
			this.css('-'+prefix[i]+'-transform','translate3d('+x+units+','+y+units+',0px)');
		}

		this.attr('translate-x',x).attr('translate-y',y).attr('translate-units',units);
		return this;
	},
	switcher:function(opts){
		return new switcher(this,opts);
	}
});

function switcher(selector,opts){
	this._element = $(selector);
	if (!opts){
		opts = {}
	}

	this._opts = opts;

	this._element.css({
		position:'relative',
		overflow:'hidden',
		padding:'0px'
	});

	/*
		horrible constructor
	*/
	this._panes = [];

	this._touchesToMove = opts.touches || 1;
	this._offset = 0;
	this._keys = opts.useArrowKeys || true;
	this._items = opts.items || false;	
	this._tension = opts.tension || 0.2;
	this._dummy = $('<div id="dummy" />');
	this._changeVelocity = opts.changeVelocity || 2.5;
 	this._lastE = false;
	this._lastChange = false;
	this._totalDistance = 0;

	me = this;

	if (this._tension < 0.5) this._tension = 0.5; // tension limits, for unexpected behaviour stuff.....

	this._dummy.css({
		'display':'none',
		'width':'100',
		'height':'100'
	});

	for (var i=0; i<5; i++){
		var e = $('<div class="switcher-pane" id="switcher-pane-'+i+'"></div>');
		
		e.css({
			position:'absolute',
			top:'0px',
			left:'0px',
			width:opts.paneWidth || '40%',
			height:'100%',
			overflow:'hidden'
		});
		
		e._translate(0,0);
		this._panes.push(e);
		this._element.append(e);
	}

	this._reset();
	this._direction = '';
	this._paneWidth = this._panes[2].outerWidth();
	this._animating = false;
	this._animation_wait = false;


	// response to the window size change
	$(window).resize(function(){
		me._scrollTo( me._getCenterPane() );
	});

	// touch event listeners
	// 		start event values reset
	this._element.on('mousedown',function(e){
		me._lastE = false;
		me._dummy.stop();
		me._totalDistance = 0;
	});

	this._element.hammer().on('touchstart',function(e){
		me._lastE = false;
		me._dummy.stop();
		me._totalDistance = 0;
	});

	/*
		bind hammer for moving the panes around
	*/
	this._element.hammer({drag_max_touches:this._touchesToMove}).on('drag',function(e){
		if (e.gesture){	
			// stop event from bubbling into elements on movable panes
			e.gesture.stopPropagation();
			e.preventDefault();
			e.stopPropagation();
	
			if (e.gesture.pointerType != 'touch' || e.gesture.touches.length >= me._touchesToMove){
				var x = e.gesture.deltaX;
				if (me._lastE){
					x = x-me._lastE.gesture.deltaX;
					me._scroll(x);
				}
				me._totalDistance += x;
				me._direction = e.gesture.deltaX;
				me._lastE = e;	
			}
		}
	});

	this._element.on('mouseleave',function(e){
		var v = 0;
		if (me._lastE.gesture){
			v = me._lastE.gesture.velocityX;
		}
		me._checkPosition(v);
	});

	// action end
	this._element.on('mouseup',function(e){
		var v = 0;
		if (me._lastE.gesture){
			v = me._lastE.gesture.velocityX;
		}
		me._checkPosition(v);
	});

	this._element.hammer().on('touchend',function(e){						
		var v = 0;
		if (me._lastE.gesture){
			v = me._lastE.gesture.velocityX;
		}
		me._checkPosition(v);
	});

	if (me._keys){
		$(document).keyup(function(e){
			if (e.keyCode == 37){
				me.prev();
			} else if (e.keyCode == 39){
				me.next();
			}
		});
	}
}


switcher.prototype = {	
	goto:function(index){
		var diff = this._offset - index;
		if (diff == -1){
			this.prev();
		} else if (diff == 1){
			this.next();
		} else if (diff!= 0){
			this._offset = index;
			this._reset();
			this._onchange();
		}
	},
	// move to next item
	next:function(){
		this._animate( this._getOffsetToCenter( this._getNext() ) );
	},
	// move to previous
	prev:function(){			
		this._animate( this._getOffsetToCenter( this._getPrev() ) );
	},
	// animate panes using dummy object
	_animate:function(distance,duration){						
		var lastStep = 0,
			me = this;
		this._animating = true;
		this._dummy.stop();
		this._dummy.css('width','100px');

		this._dummy.animate({
			width:0
		},{
			step:function(step){
				var cdist = (step-100) * (distance/100);					
				me._scroll( -(cdist-lastStep));
				lastStep = cdist;
			},
			complete:function(){
				me._animating = false;
			},
			duration: duration || 200
		});
	},
	// check the position of divs
	_checkPosition:function(v){
		var c = this._getNearestOfCenter(),
			offset = this._getOffsetToCenter(c);
		// if tension is exceeded, pane is switched
		if (Math.abs(offset) >= this._paneWidth*this._tension || v>=this._changeVelocity){
			if (this._direction <0 ){
				this.next();
			} else {
				this.prev();
			}
		} else { 				
			this._animate( this._getOffsetToCenter( this._getPanesByPosition()[2]) );
		}
		this._onDragEnd(); // this usually is done after the touchend (or mouseup)
	},
	// show certain pane
	_scrollTo:function(pane){
		this._scroll( this._getOffsetToCenter(pane));
	},
	// reset
	_reset:function(){			
		this._panes[2]._translate( this._element.innerWidth()/2 - this._panes[2].outerWidth(true)/2 ,0);
		this._panes[1]._translate( this._element.innerWidth()/2 - this._panes[2].outerWidth(true)/2 - this._panes[1].outerWidth(true) ,0);
		this._panes[0]._translate( this._element.innerWidth()/2 - this._panes[2].outerWidth(true)/2 - this._panes[1].outerWidth(true) - this._panes[0].outerWidth(true) ,0);
		this._panes[3]._translate( this._element.innerWidth()/2 + this._panes[2].outerWidth(true)/2,0);
		this._panes[4]._translate( this._element.innerWidth()/2 + this._panes[2].outerWidth(true)/2 + this._panes[3].outerWidth(true),0);				

		this._setOffset();

		var panes = this._getPanesByPosition();

		for (var i in panes){
			var index = parseInt( i ) + this._offset - 2;
			panes[i].attr('scroll-index', index);
			panes[i].html(this._getListItem(index));
			panes[i].attr('list-index', this._getListItemIndex(this._getListItem(index)));
		}
	},
	_getRightPane:function(){
		return this._getPanesByPosition()[4];
	},
	_getLeftPane:function(){
		return this._getPanesByPosition()[0];
	},
	_getCenterPane:function(){
		return this._getPanesByPosition()[2];
	},
	_getNext:function(){
		return this._getPanesByPosition()[3];
	},
	_getPrev:function(){
		return this._getPanesByPosition()[1];
	},
	_getPanesByPosition:function(){
		var a = [];
		for (var i in this._panes){
			a.push(this._panes[i]);
		}

		a.sort(function(a,b){
			return a._getPosition().left - b._getPosition().left;
		});

		return a;
	},
	_getOffsetToCenter:function(pane){
		var center = this._element.innerWidth()/2,
			pane_center = pane._getPosition().left +  pane.outerWidth()/2;				
		return center - pane_center;
	},
	_getNearestOfCenter:function(){
		var diff = Infinity,
			pane = false;

		for (var i in this._panes){
			var offset = Math.abs( this._getOffsetToCenter( this._panes[i]) );
			if (offset < diff){
				diff = offset;
				pane = this._panes[i];
			}
		}
		return pane;
	},
	 _setOffset:function(){
		var rp = this._getRightPane(),
			lp = this._getLeftPane();

		rp.attr('scroll-index', this._offset+2).html( this._getListItem(this._offset+2)).attr('list-index', this._getListItemIndex( this._getListItem( this._offset+2)));
		lp.attr('scroll-index', this._offset-2).html( this._getListItem(this._offset-2)).attr('list-index', this._getListItemIndex( this._getListItem( this._offset-2)));
	},
	_getListItem:function(index){
		if (index >= this._items.length){
			return this._getListItem( index - this._items.length);
		}  else if (index < 0){								
			return this._getListItem(this._items.length + index);
		} else {
			return this._items[index];
		}
	},
	_getListItemIndex:function(item){
		//.indexof(item)
		for (var i in this._items){
			if (this._items[i] == item){
				return i;
			}
		}
	},
	_getIndex:function(pane){
		return parseInt( pane.attr('scroll-index') );
	},
	_onDragEnd:function(){
		if (this._opts.dragend){
			var pane =  this._getCenterPane();
			opts.dragend.call(pane,this._getListItemIndex(this._getIndex(pane)));
		}
	},
	_onchange:function(newPane){
		if (this._opts.onchange){
			var pane =  this._getCenterPane();
			if (this._getIndex(pane) != this._lastChange){
				this._opts.onchange.call(pane,newPane,this._getListItemIndex(this._getIndex(pane)));
				this._lastChange = this._getIndex(pane);
			}
		}
	},
	// scroll function, moves elements
	_scroll:function(px){	
		var panes = this._getPanesByPosition();	// panes sorted by position
		x = panes[2]._getPosition().left + px; // middle pane position, other positions are based on this one

		panes[2]._translate( x ,0); // the middle pane				
		panes[1]._translate( x - panes[1].outerWidth(true) ,0); // one to the left
		panes[0]._translate( x - panes[1].outerWidth(true) - panes[0].outerWidth(true) ,0);	// leftmost pane
		panes[3]._translate( x + panes[2].outerWidth(true) ,0);	// one to the right
		panes[4]._translate( x + panes[2].outerWidth(true) + panes[3].outerWidth(true),0);	// rightmost pane
		
		if (Math.abs(this._getOffsetToCenter(panes[0])) > 2.5*panes[0].outerWidth()){
			var right = this._getRightPane(),
				left = this._getLeftPane();						
			left._translate( right._getPosition().left +  right.outerWidth(true) );
			this._offset++;
			this._setOffset();
			this._onchange(left);
		} else if (Math.abs(this._getOffsetToCenter(panes[4])) > 2.5*panes[0].outerWidth()){
			var right = this._getRightPane(),
				left = this._getLeftPane();					
			
			right._translate( left._getPosition().left - right.outerWidth(true));
			this._offset--;
			this._setOffset();

			this._onchange(right);				
		}

		if (this._opts.ondrag){
			this._opts.ondrag(px);
		}
	}
}
