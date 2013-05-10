$.fn.extend({
	_getPosition:function(){
		return {
			top:parseFloat( this.attr('translate-y') ),
			left:parseFloat( this.attr('translate-x') ),
			unit:this.attr('translate-units')
		}
	},
	_translate:function(x,y,units){
		if (!units){
			units = 'px';
		}
		
		var prefix = ['moz','o','ms','webkit'];
		for (var i in prefix){
			this.css('-'+prefix[i]+'-transform','translate('+x+units+','+y+units+')');
		}

		this.attr('translate-x',x).attr('translate-y',y).attr('translate-units',units);
		return this;
	},
	switcher:function(opts){
/*
			infinite pane based scroller
			Heikki Pesonen
			Metropolia School of applied sciences
			2013

			switches between five divs,


		callbacks:

			onchange: fired each time the middle pane changes
			dragend: when draggin of the scroller has ended

			the middle pane is returned as "this"



		usage: 

				$('selector').switcher({
					onchange:function(){
						// do stuff
					},
					dragend:function(){
						// do stuff
					}
				});
*/
		if (!opts){
			opts = {}
		}

		this.css({
			position:'relative',
			overflow:'hidden',
			padding:'0px'
		});

		var _panes = [],				
			_offset = 0,
			_items = opts.items || false,			
			_tension = opts.tension || 0.4,
			me = this;

		for (var i=0; i<5; i++){
			var e = $('<div class="switcher-pane" id="switcher-pane-'+i+'"></div>');
			
			e.css({
				position:'absolute',
				top:'0px',
				left:'0px',
				width:opts.paneWidth || '20%',
				height:'100%'
			});
			
			e._translate(0,0);
			_panes.push(e);
			this.append(e);
		}
		_reset.call(this);

		var _lastE = false,
			_totalDistance = 0,
			_paneWidth = _panes[2].outerWidth();


		// response to the window size change
		$(window).resize(function(){
			_scrollTo( _getCenterPane() );
		});

		// touch event listeners
		this.on('mousedown',function(){
			_lastE = false;
		});
		this.hammer().on('touchstart',function(){
			_lastE = false;
		});

		this.hammer().on('drag',function(e){	
			var x = e.gesture.deltaX;
			if (_lastE){
				x = x-_lastE.gesture.deltaX;
			}
			_scroll(x);
			_lastE = e;
		});
		this.on('mouseup',function(){
			_checkPosition();
		});
		this.hammer().on('touchend',function(e){
			_checkPosition();
		});

		function _checkPosition(){
			var c = _getNearestOfCenter(),
				offset = _getOffsetToCenter(c);
			
			// if tension is exceeded, pane is switched
			if (Math.abs(offset) >= _paneWidth*_tension){
				_scroll(offset);
			} else { // else, current pane is sprung back
				_scrollTo( _getPanesByPosition()[2] );
			}
			
			if (opts.dragend){
				opts.dragend.call(c);
			}
			$('.center').removeClass('center');
			c.addClass('center');			
		}

		function _scrollTo(pane){
			var offset = _getOffsetToCenter(pane);
			_scroll(offset);
		}


		function _reset(){			
			_panes[2]._translate( this.innerWidth()/2 - _panes[2].outerWidth(true)/2 ,0);
			_panes[1]._translate( this.innerWidth()/2 - _panes[2].outerWidth(true)/2 - _panes[1].outerWidth(true) ,0);
			_panes[0]._translate( this.innerWidth()/2 - _panes[2].outerWidth(true)/2 - _panes[1].outerWidth(true) - _panes[0].outerWidth(true) ,0);				
			_panes[3]._translate( this.innerWidth()/2 + _panes[2].outerWidth(true)/2,0);
			_panes[4]._translate( this.innerWidth()/2 + _panes[2].outerWidth(true)/2 + _panes[3].outerWidth(true),0);				

			_setOffset();
		}

		function _getRightPane(){
			var mx = -Infinity;
			var p = false;
			for (var i in _panes){
				if (_panes[i]._getPosition().left > mx){
					p= _panes[i];
					mx = _panes[i]._getPosition().left;
				}
			}
			return p;
		}

		function _getLeftPane(){
			var mx = Infinity;
			var p = false;
			for (var i in _panes){
				if (_panes[i]._getPosition().left < mx){
					p = _panes[i];
					mx = _panes[i]._getPosition().left;
				}
			}
			return p;
		}

		function _getCenterPane(){
			var a = _getPanesByPosition();

			if (a.length == 5){
				return a[2];
			} else if (a.length == 3){
				return a[1];
			}
		}

		function _getPanesByPosition(){
			var a = [];
			for (var i in _panes){
				a.push(_panes[i]);
			}

			a.sort(function(a,b){
				return a._getPosition().left - b._getPosition().left;
			});

			return a;
		}

		function _getOffsetToCenter(pane){
			var center = me.innerWidth()/2,
				pane_center = pane._getPosition().left +  pane.outerWidth()/2;
				
			return center - pane_center;
		}

		function _getNearestOfCenter(){
			var diff = Infinity,
				pane = false;

			for (var i in _panes){
				var offset = Math.abs( _getOffsetToCenter(_panes[i]) );
				if (offset < diff){
					diff = offset;
					pane = _panes[i];
				}
			}

			return pane;
		}

		function _setOffset(){
			var panes = _getPanesByPosition();
			for (var i in panes){			
				var index = parseInt( i ) + _offset - 2;	
				panes[i].attr('scroll-index', index);
				panes[i].html(_getListItem(index));
			}
		}

		function _getListItem(index){
			if (index >= _items.length){
				return _getListItem( index - _items.length);
			}  else if (index < 0){								
				return _getListItem(Math.abs(index) );
			} else {
				return _items[index];
			}
		}

		function _scroll(px){	
			var panes = _getPanesByPosition();	// panes sorted by position
			x = panes[2]._getPosition().left + px; // middle pane position, other positions are based on this one

			panes[2]._translate( x ,0); // the middle pane				
			panes[1]._translate( x - panes[1].outerWidth(true) ,0); // one to the left
			panes[0]._translate( x - panes[1].outerWidth(true) - panes[0].outerWidth(true) ,0);	// leftmost pane
			panes[3]._translate( x + panes[2].outerWidth(true) ,0);	// one to the right
			panes[4]._translate( x + panes[2].outerWidth(true) + panes[3].outerWidth(true),0);	// rightmost pane
			
			if (Math.abs(_getOffsetToCenter(panes[0])) > 2.5*panes[0].outerWidth()){
				var right = _getRightPane(),
					left = _getLeftPane();						
				left._translate( right._getPosition().left +  right.outerWidth(true) );
				if (opts.onchange){
					opts.onchange.call( _getCenterPane() );
				}
				_offset++;
				_setOffset();
			} else if (Math.abs(_getOffsetToCenter(panes[4])) > 2.5*panes[0].outerWidth()){
				var right = _getRightPane(),
					left = _getLeftPane();					
				right._translate( left._getPosition().left );
				if (opts.onchange){
					opts.onchange.call( _getCenterPane() );
				}
				_offset--;
				_setOffset();
			}

			if (opts.ondrag){
				opts.ondrag.call(me,px);
			}
		}


	}
});
