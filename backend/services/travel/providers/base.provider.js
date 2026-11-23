/**
 * Base Abstract Classes for Travel Providers.
 * Enforces standardized data contracts and prevents fabrication of missing data.
 */

export class BaseFlightProvider {
  constructor(name = "GenericFlightProvider") {
    this.name = name;
  }

  /**
   * Search for flight offers.
   * @param {Object} params - { origin, destination, departureDate, returnDate, passengers, cabin }
   * @returns {Promise<{ provider: string, lastUpdated: string, currency: string, results: Array }>}
   */
  async searchFlights(params) {
    throw new Error(`searchFlights() not implemented in ${this.name}`);
  }
}

export class BaseHotelProvider {
  constructor(name = "GenericHotelProvider") {
    this.name = name;
  }

  /**
   * Search for hotel offers.
   * @param {Object} params - { destination, checkIn, checkOut, guests, rooms }
   * @returns {Promise<{ provider: string, lastUpdated: string, currency: string, results: Array }>}
   */
  async searchHotels(params) {
    throw new Error(`searchHotels() not implemented in ${this.name}`);
  }
}

export class BaseWeatherProvider {
  constructor(name = "GenericWeatherProvider") {
    this.name = name;
  }

  /**
   * Get current weather conditions.
   * @param {string} location
   */
  async getCurrentWeather(location) {
    throw new Error(`getCurrentWeather() not implemented in ${this.name}`);
  }

  /**
   * Get hourly weather forecast.
   * @param {string} location
   * @param {string} [date] - YYYY-MM-DD
   */
  async getHourlyForecast(location, date) {
    throw new Error(`getHourlyForecast() not implemented in ${this.name}`);
  }

  /**
   * Get forecast corresponding to an exact activity date and time.
   * @param {Object} params - { location, date, time }
   */
  async getActivityWeather(params) {
    throw new Error(`getActivityWeather() not implemented in ${this.name}`);
  }
}

export class BaseTransportProvider {
  constructor(name = "GenericTransportProvider") {
    this.name = name;
  }

  /**
   * Get route distance, duration and traffic level.
   * @param {Object} params - { origin, destination, mode }
   */
  async getRouteStatus(params) {
    throw new Error(`getRouteStatus() not implemented in ${this.name}`);
  }
}
