import { FieldName, FieldPath, RegistrationUpdater } from './types';

export function mkDefault<TValue>(defaultValue: TValue, ...values: Array<TValue | undefined>) {
  const result = values.find(v => v !== undefined);
  if(result !== undefined) return result;
  return defaultValue;
}

type AccessorFn<T> = (obj: any, key: FieldName) => T;
export function getIn<T = unknown>(obj: any, path: FieldPath, accessor?: AccessorFn<T>): T | undefined {
  return path.reduce(
    (result, key) => {
      if(result === undefined || result === null) return undefined;
      if(accessor) return accessor(result, key);
      return result[key];
    },
    obj
  );
}

export function setIn<T>(obj: any, path: FieldPath, value: T) {
  if(path.length === 1) {
    obj[path[0]] = value;
    return;
  }

  // Prepare object by creating the necessary path
  const lastObj = path.slice(0, -1).reduce(
    (result, key) => {
      if(!result[key]) result[key] = {};
      return result[key];
    }, obj
  );

  lastObj[path[path.length - 1]] = value;
}

const objectCtorString = Object.prototype.constructor.toString()
export function isPlainObject(value: any): boolean {
	if (!value || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	if (proto === null) {
		return true;
	}
	const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
	if (Ctor === Object) return true;

	return typeof Ctor == "function" && Function.toString.call(Ctor) === objectCtorString;
}

export function createProxy(identifier: symbol, form: Record<FieldName, any>, prevPath: FieldPath, onAccess: (path: FieldPath) => void): any {
  const parent: any = getIn(form, prevPath);

  return new Proxy(Array.isArray(parent) ? [] : {}, {
    get(state, prop, receiver) {
      if(prop === identifier) return [parent, prevPath];

      const value = parent[prop];
      const path = [...prevPath, prop];
      if(Array.isArray(value) || isPlainObject(value)) {
        return createProxy(identifier, form, path, onAccess);
      } else {
        onAccess(path);
        if(value instanceof Function) {
          return value.bind(receiver);
        }
        return value;
      }
    },
    has(state, prop) {
      return prop in parent;
    },
    ownKeys(state) {
      return Reflect.ownKeys(parent);
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(parent);
    },
    getOwnPropertyDescriptor(state, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(parent, prop);
      if(!desc) return desc;

      return {
        ...desc,
        writable: false,
        configurable: true,
        value: parent[prop],
      };
    },
    set() {
      throw new Error('Direct modifications on form data are not allowed! Use `updateForm`!');
    },
    defineProperty() {
      throw new Error('Direct modifications on form data are not allowed! Use `updateForm`!');
    },
    deleteProperty() {
      throw new Error('Direct modifications on form data are not allowed! Use `updateForm`!');
    },
    setPrototypeOf() {
      throw new Error('Direct modifications on form data are not allowed! Use `updateForm`!');
    }
  });
}

type Fields<TValue> = {[key: FieldName]: Fields<TValue> | TValue};
export class FieldsMap<TValue> {
  private fields: Fields<TValue> = {};

  public get(path: FieldPath, accessor?: AccessorFn<TValue>): Fields<TValue> | TValue | undefined {
    return getIn(this.fields, path, accessor);
  }

  public has(path: FieldPath): boolean {
    return this.get(path) !== undefined;
  }

  public set(path: FieldPath, value: TValue): void {
    setIn(this.fields, path, value);
  }

  public delete(path: FieldPath): void {
    const reference: any = this.get(path.slice(0, -1));
    if(isPlainObject(reference)) {
      delete reference[path[path.length - 1]];
    }
  }
}


export function callRegistrations<TForm>(registrations: FieldsMap<RegistrationUpdater<TForm>[]>, path: FieldPath, onUpdate: (listener: RegistrationUpdater<TForm>) => void) {
  const listeners = registrations.get(path, (obj, key) => Object.getOwnPropertyDescriptor(obj, key)?.value);
  if(!listeners) return;

  if(Array.isArray(listeners)) {
    listeners.forEach(onUpdate);
  } else {
    // An object is referenced. Anything that listens deeper than this needs to be updated.
    Object.getOwnPropertyNames(listeners).forEach(field => {
      callRegistrations(registrations, [...path, field], onUpdate);
    });
  }
}