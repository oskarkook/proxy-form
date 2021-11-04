import { FieldName, FieldPath, RegistrationUpdater } from './types';

export function mkDefault<TValue>(defaultValue: TValue, ...values: Array<TValue | undefined>) {
  const result = values.find(v => v !== undefined);
  if(result !== undefined) return result;
  return defaultValue;
}

type AccessorFn<T> = (obj: any, key: FieldName) => T;
const objGetter: AccessorFn<any> = (obj, key: any) => obj[key];
export function getIn<T = unknown>(obj: any, path: FieldPath, accessor: AccessorFn<T> = objGetter): T | undefined {
  return path.reduce(
    (result, key) => {
      if(result === undefined || result === null) return undefined;
      return accessor(result, key);
    },
    obj
  );
}

type SetterFn<T> = (obj: any, key: FieldName, value: T) => void;
const objSetter: SetterFn<any> = (obj, key: any, value) => obj[key] = value;
export function setIn<T>(obj: any, path: FieldPath, value: T, defaultValue: () => any, accessor: AccessorFn<T> = objGetter, setter: SetterFn<T> = objSetter) {
  if(path.length === 1) {
    setter(obj, path[0], value);
    return;
  }

  // Prepare object by creating the necessary path
  const lastObj = path.slice(0, -1).reduce(
    (result, key) => {
      let keyValue = accessor(result, key);
      if(keyValue === undefined) {
        keyValue = defaultValue();
        setter(result, key, keyValue);
      }
      return keyValue;
    }, obj
  );

  setter(lastObj, path[path.length - 1], value);
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

export function isFunction(value: any): value is Function {
  return value instanceof Function || typeof value === 'function';
}

export function isMap(value: any): value is Map<any, any> {
  return value instanceof Map;
}

export function createProxy<TForm>(identifier: symbol, form: TForm, prevPath: FieldPath, onAccess: (path: FieldPath) => void): any {
  const parent: any = getIn(form, prevPath);

  return new Proxy(Array.isArray(parent) ? [] : {}, {
    get(state, prop, receiver) {
      if(prop === identifier) return [parent, prevPath];

      const value = parent[prop];
      if(Array.isArray(value) || isPlainObject(value)) {
        const path = [...prevPath, prop];
        return createProxy(identifier, form, path, onAccess);
      } else if(isFunction(value)) {
        onAccess([...prevPath, prop]);
        return value.bind(receiver);
      } else {
        onAccess([...prevPath, prop]);
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

type Fields<TValue> = Map<FieldName, Fields<TValue> | TValue>;
export class FieldsMap<TValue> {
  private fields: Fields<TValue> = new Map();

  public get(path: FieldPath): Fields<TValue> | TValue | undefined {
    return getIn(this.fields, path, (map, key) => map.get(String(key)));
  }

  public has(path: FieldPath): boolean {
    return this.get(path) !== undefined;
  }

  public set(path: FieldPath, value: TValue): void {
    setIn(this.fields, path, value, () => new Map(), (map, key) => map.get(String(key)), (map, key, value) => map.set(String(key), value));
  }

  public delete(path: FieldPath): void {
    const reference = this.get(path.slice(0, -1));
    if(isMap(reference)) {
      reference.delete(path[path.length - 1]);
    }
  }
}


export function groupListeners<TForm>(registrations: FieldsMap<RegistrationUpdater<TForm>[]>, paths: FieldPath[], set: Set<RegistrationUpdater<TForm>> = new Set()): Set<RegistrationUpdater<TForm>> {
  paths.forEach(path => {
    const listeners = registrations.get(path);
    if(!listeners) return undefined;

    if(Array.isArray(listeners)) {
      listeners.forEach(l => set.add(l));
    } else {
      // An object is referenced. Anything that listens deeper than this needs to be updated.
      const nestedPaths = Array.from(listeners.keys()).map(name => [...path, name]);
      groupListeners(registrations, nestedPaths, set);
    }
  });

  return set;
}