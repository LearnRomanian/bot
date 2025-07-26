export default Object.freeze({
	youtubeVideo: (id: string) => `https://www.youtube.com/watch?v=${id}`,
	youtubePlaylist: (id: string) => `https://www.youtube.com/watch?list=${id}`,
} as const satisfies Record<string, (...args: string[]) => string>);
