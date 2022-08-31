import { ApplicationCommandOptionTypes } from '../../deps.ts';
import { OptionBuilder } from './command.ts';

const elements: OptionBuilder = {
	name: 'number',
	nameLocalizations: {
		pl: 'liczba',
		ro: 'număr',
	},
	description: 'The number of elements to manage.',
	descriptionLocalizations: {
		pl: 'Liczba elementów do zarządzania.',
		ro: 'Numărul de elemente de gestionat.',
	},
	type: ApplicationCommandOptionTypes.Integer,
	required: true,
};

const index: OptionBuilder = {
	name: 'index',
	nameLocalizations: {
		pl: 'indeks',
		ro: 'index',
	},
	description: 'The index of the element.',
	descriptionLocalizations: {
		pl: 'Indeks elementu.',
		ro: 'Indexul elementului.',
	},
	type: ApplicationCommandOptionTypes.Integer,
	required: true,
};

const user: OptionBuilder = {
	name: 'user',
	nameLocalizations: {
		pl: 'użytkownik',
		ro: 'utilizator',
	},
	description: 'The user\'s name, tag, ID or mention.',
	descriptionLocalizations: {
		pl: 'Nazwa użytkownika, tag, ID lub tag.',
		ro: 'Numele utilizatorului, tag, ID sau',
	},
	type: ApplicationCommandOptionTypes.String,
	required: true,
	autocomplete: true,
};

const show: OptionBuilder = {
	name: 'show',
	nameLocalizations: {
		pl: 'wyświetl',
		ro: 'afișează',
	},
	description: 'If set to true, the result will be shown to others.',
	descriptionLocalizations: {
		pl: 'Jeśli tak, rezultat będzie wyświetlony innym użytkownikom.',
		ro: 'Dacă da, rezultatul va fi afișat altor utilizatori.',
	},
	type: ApplicationCommandOptionTypes.Boolean,
};

export { elements, index, show, user };
