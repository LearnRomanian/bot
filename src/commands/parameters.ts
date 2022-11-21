import { ApplicationCommandOptionTypes } from 'discordeno';
import { createLocalisations, Parameters } from '../../assets/localisations/mod.ts';
import { OptionBuilder } from './mod.ts';

const elements: OptionBuilder = {
	...createLocalisations(Parameters.global.elements),
	type: ApplicationCommandOptionTypes.Integer,
	required: true,
};

const index: OptionBuilder = {
	...createLocalisations(Parameters.global.index),
	type: ApplicationCommandOptionTypes.Integer,
	required: true,
};

const user: OptionBuilder = {
	...createLocalisations(Parameters.global.user),
	type: ApplicationCommandOptionTypes.String,
	required: true,
	autocomplete: true,
};

const show: OptionBuilder = {
	...createLocalisations(Parameters.global.show),
	type: ApplicationCommandOptionTypes.Boolean,
};

export { elements, index, show, user };
