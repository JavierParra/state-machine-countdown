/**
 * Countdown handler using a simple State Machine.
 */

(() => {
	/**
	 * _abstract_ class. Represents a State in the application.
	 *
	 * A state receives an input and optionally returns a new State.
	 */
	class State {
		/**
		 * This function will be called whenever this state is shown.
		 */
		load() {

		}

		/**
		 * This function will be called whenever this state is hidden.
		 */
		unload() {

		}

		/**
		 * Send an input to the state.
		 *
		 * @param {Input}
		 */
		receiveInput(obj) {
			var handler, nextState;

			if(!Input.isInput(obj)) {
				throw 'Unidentified input';
			}

			handler = this[`${obj.id}Input`];

			if(typeof handler !== 'function') {
				console.warn(`${this.id()} cannot handle ${obj.id}Input`);
				return;
			}

			nextState = handler.call(this, obj.parameters);

			if(!nextState) {
				return;
			}

			this.unload();
			nextState.load();
			nextState.receiveInput(obj);
		}

		id() {
			return this.constructor.name.toLowerCase();
		}
	}

	function Input() {}

	/**
	 * The input is just a duck type:
	 *
	 * {id: {string}, parameters: {Object}}
	 */
	Input.isInput = obj => (
		typeof obj.id === 'string' && typeof obj.parameters === 'object'
	);

	/**
	 * Initial state that handles page load.
	 */
	class Pending extends State {
		loadedInput() {
			var date = localStorage.getItem('date');
			if(date) {
				date = new Date(Number(date));
				this.receiveInput({id: 'dateSelected', parameters: {
					date
				}});
				return;
			}
			this.receiveInput({id: 'selectDate', parameters: {}});
		}

		dateSelectedInput() {
			return new Countdown();
		}

		selectDateInput() {
			return new SelectDate();
		}
	}

	/**
	 * State that handles the date selector.
	 */
	class SelectDate extends State {
		load() {
			this.element = document.querySelector('#select');
			this.selector = this.element.querySelector('input[type=date]');
			this.element.classList.add('show');
			this.selector.value = '';

			this.changeHandler = () => {
				var date, year, month, day;
				var val = this.selector.value;
				this.element.querySelector('*.error').classList.remove('show');

				if(!val) {
					return;
				}

				// Safari does not support date input so we fallback to text.
				if(!val.match(/\d{4}-\d{2}-\d{2}/)) {
					this.receiveInput({id: 'error', parameters: {
						error: 'The date must be in yyyy-mm-dd format'
					}});
					return;
				}

				[year, month, day] = val.split('-');
				date = new Date(year, month - 1, day);
				this.receiveInput({id: 'dateSelected', parameters: {date}});
			};

			if(!this.selector.listening){
				this.selector.addEventListener('change', this.changeHandler);
			}

			this.selector.listening = true;
			localStorage.removeItem('date');
		}

		unload() {
			this.element.classList.remove('show');
		}

		selectDateInput() {
		}

		errorInput(parameters) {
			var errorEl = this.element.querySelector('*.error');
			errorEl.innerHTML = parameters.error;
			errorEl.classList.add('show');
		}

		dateSelectedInput() {
			return new Countdown();
		}

	}

	/**
	 * State that handles the actual countdown.
	 */
	class Countdown extends State {
		load() {
			this.changeClick = () => {
				this.receiveInput({id: 'selectDate', parameters: {}});
			};

			this.finishClick = () => {
				this.receiveInput({id: 'finishCountdown', parameters: {}});
			};

			this.element = document.querySelector('#countdown');
			this.element.classList.add('show');
			this.element.querySelector('a.change').addEventListener('click', this.changeClick);
			this.element.querySelector('a.finish').addEventListener('click', this.finishClick);

		}

		unload() {
			if(this.timeout) {
				window.clearTimeout(this.timeout);
			}

			this.element.querySelector('a.change').addEventListener('click', this.changeClick);
			this.element.classList.remove('show');
			Array.from(this.element.querySelectorAll('*[data-fragment]')).map(el => {
				el.classList.remove('show');
			});
		}

		/**
		 * Handles a date selection.
		 *
		 * @param {Object} parameters - Expects a date key.
		 */
		dateSelectedInput(parameters) {
			var date = parameters.date.getTime();
			if(date < Date.now()) {
				return this.receiveInput({id: 'error', parameters: {
					error: 'La fecha no puede ser en el pasado',
				}});
			}

			if(isNaN(date)) {
				return this.receiveInput({id: 'error', parameters: {
					error: 'Fecha inválida',
				}});
			}

			localStorage.setItem('date', date);
			return this.receiveInput({id: 'updateRemaining', parameters: {
				...parameters
			}});
		}

		/**
		 * Handles scheduling the next render.
		 */
		updateRemainingInput(parameters) {
			var date = parameters.date.getTime();
			var diff = Math.round((date - Date.now()) / 1000);

			if(diff <= 0) {
				return this.receiveInput({id: 'arrived', parameters: {}});
			}

			this.render(this.remainingParts(diff));
			this.timeout = window.setTimeout(this.receiveInput.bind(this, {id: 'updateRemaining', parameters: {
				...parameters
			}}), 1000);
		}

		finishCountdownInput() {
			this.unload();
			this.load();
			var date = new Date(Date.now() + 5000);

			return this.receiveInput({id: 'dateSelected', parameters: {
				date
			}});
		}

		selectDateInput() {
			return new SelectDate();
		}

		/**
		 * Handles the DOM operations for rendering the countdown.
		 */
		render(parts) {
			for(let part of Object.keys(parts)) {
				let val = parts[part];
				let element = this.element.querySelector(`*[data-fragment=${part}]`);
				element.classList.add('show');
				element.querySelector('span.num').innerHTML = val;
			}
		}

		/**
		 * Process a time difference in seconds into precisions that make sense.
		 *
		 * @param {int} diff
		 *
		 * @return {Object} - {day, hour, minute, second}
		 */
		remainingParts(diff) {
			var parts = {
				day: 0,
				hour: 24,
				minute: 60,
				second: 60,
			};

			var keys = Object.keys(parts);
			var remaining = {};
			var current = diff;

			for(let i = keys.length - 1; i >= 0; i--) {
				let key = keys[i];
				let modifier = parts[key];
				let part;

				if(!modifier || modifier > current) {
					remaining[key] = current;
					break;
				}

				part = current % modifier;
				current = Math.floor(current / modifier);
				remaining[key] = part;
			}

			return remaining;

		}

		arrivedInput() {
			localStorage.removeItem('date');
			return new Arrived();
		}

		errorInput() {
			return new SelectDate();
		}
	}

	/**
	 * State that handles when the countdown finished.
	 */
	class Arrived extends State {
		load() {
			this.element = document.querySelector('#arrived');
			this.element.classList.add('show');
			var element = this.element;

			function attachConfetti() {
				let cf = document.createElement('span');
				cf.classList.add('confetti');
				cf.style.left = Math.random() * document.body.offsetWidth + 'px';
				cf.style.background = ['red', 'blue', 'yellow', 'green'][(Math.random() * 3) | 0];
				cf.style.zIndex = Math.round(Math.random() * 5);
				element.appendChild(cf);
			}

			for(let i = 0; i < 200; i++) {
				setTimeout(attachConfetti, Math.random() * 22500);
			}
		}

		arrivedInput() {

		}

		unload() {
			this.element.classList.remove('show');
		}
	}

	document.addEventListener('DOMContentLoaded', (event) => {
		var curState = new Pending();

		curState.receiveInput({
			id: 'loaded',
			parameters: {event}
		});
	});

})();
