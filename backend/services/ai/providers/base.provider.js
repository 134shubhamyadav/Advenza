/**
 * Abstract Base Provider for AI completion engines.
 */
export class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return false;
  }

  async createCompletion(options) {
    throw new Error(`createCompletion not implemented for ${this.name}`);
  }
}

export default BaseAIProvider;
