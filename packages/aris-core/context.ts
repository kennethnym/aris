export interface Location {
	lat: number
	lng: number
	accuracy: number
}

export interface Context {
	time: Date
	location?: Location
}
