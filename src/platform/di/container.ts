export type ServiceFactory<T> = () => T | Promise<T>;

/** Lightweight DI container — register factories, resolve lazily (singleton per registration). */
export class Container {
  private readonly factories = new Map<symbol, ServiceFactory<unknown>>();
  private readonly singletons = new Map<symbol, unknown>();

  register<T>(token: symbol, factory: ServiceFactory<T>): void {
    if (this.factories.has(token)) {
      throw new Error(`Service already registered: ${token.toString()}`);
    }
    this.factories.set(token, factory as ServiceFactory<unknown>);
  }

  async resolve<T>(token: symbol): Promise<T> {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Service not registered: ${token.toString()}`);
    }

    const instance = await factory();
    this.singletons.set(token, instance);
    return instance as T;
  }

  clear(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}

export const platformContainer = new Container();
