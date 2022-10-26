import { Language } from '../../src/types.ts';
import { TranslationLanguage } from './languages.ts';
import { ensureType } from './types.ts';

type TranslationLanguageMappings = Required<
	Record<TranslationLanguage, string>
>;

type LanguageMappings = Required<Record<Language, string>>;

class Expressions {
	static readonly polish = {
		cases: {
			// Do not change key names.
			genitive: {
				languages: ensureType<TranslationLanguageMappings>({
					'Armenian': 'Ormiańskiego',
					'Belarusian': 'Białoruskiego',
					'Bulgarian': 'Bułgarskiego',
					'Chinese': 'Chińskiego',
					'Chinese (simplified)': 'Chińskiego (Uproszczonego)',
					'Czech': 'Czeskiego',
					'Danish': 'Duńskiego',
					'Dutch': 'Niderlandzkiego',
					'English': 'Angielskiego',
					'English (American)': 'Angielskiego (Amerykańskiego)',
					'English (British)': 'Angielskiego (Brytyjskiego)',
					'Estonian': 'Estońskiego',
					'Finnish': 'Fińskiego',
					'French': 'Francuskiego',
					'German': 'Niemieckiego',
					'Greek': 'Greckiego',
					'Hungarian': 'Węgierskiego',
					'Indonesian': 'Indonezyjskiego',
					'Italian': 'Włoskiego',
					'Japanese': 'Japońskiego',
					'Latvian': 'Łotewskiego',
					'Lithuanian': 'Litewskiego',
					'Polish': 'Polskiego',
					'Portuguese': 'Portugalskiego',
					'Portuguese (Brazilian)': 'Portugalskiego (Brazylijskiego)',
					'Portuguese (European)': 'Portugalskiego (Europejskiego)',
					'Romanian': 'Rumuńskiego',
					'Russian': 'Rosyjskiego',
					'Slovak': 'Słowackiego',
					'Slovenian': 'Słoweńskiego',
					'Spanish': 'Hiszpańskiego',
					'Swedish': 'Szwedzkiego',
					'Turkish': 'Tureckiego',
					'Ukrainian': 'Ukraińskiego',
				}),
			},
			instrumental: {
				languages: {
					'Armenian': 'ormiańskim',
					'Belarusian': 'białoruskim',
					'English': 'angielskim',
					'Polish': 'polskim',
					'Romanian': 'rumuńskim',
				},
			},
		},
	};

	static readonly romanian = {
		cases: {
			genitive: {
				indefinite: {
					languages: ensureType<LanguageMappings>({
						'Armenian': 'armene',
						'Belarusian': 'belaruse',
						'English': 'engleze',
						'Polish': 'poloneze',
						'Romanian': 'române',
					}),
				},
			},
		},
	};
}

export { Expressions };
