import { FieldName, FieldPath, RegistrationUpdater } from './types';

export function mkDefault<TValue>(defaultValue: TValue, ...values: Array<TValue | undefined>) {
  const result = values.find(v => v !== undefined);
  if(result !== undefined) return result;
  return defaultValue;
}

type AccessorFn<T> = (obj: any, key: FieldName) => T;
const objGetter: AccessorFn<any> = (obj, key: any) => {
  if(!obj.hasOwnProperty(key)) return undefined;
  return obj[key];
};
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

const selfRef = '$$proxy-form$self';
type Fields<TValue> = {[key: FieldName]: Fields<TValue>};
export class FieldsMap<TValue> {
  private fields: Fields<TValue> = {};

  /**
   * Returns data stored at the given path
   */
  public get(path: FieldPath): TValue | undefined {
    path = [...path, selfRef];
    return getIn(this.fields, path);
  }

  /**
   * Returns all data related to this path, even nested values
   */
  public getAllNested(path: FieldPath, maxDepth?: number): TValue[] {
    const map: Fields<TValue> | undefined = getIn(this.fields, path);
    if(!map) return [];

    const result: TValue[] = [];
    function explore(map: Fields<TValue>, depth: number) {
      Object.getOwnPropertyNames(map).forEach(key => {
        const value = map[key];
        if(!value) return;

        if(key === selfRef) {
          result.push(value as any);
        } else if(maxDepth === undefined || depth < maxDepth) {
          explore(value, depth + 1);
        }
      });
    }

    explore(map, 0);
    return result;
  }

  /**
   * Returns existing path keys under the given path
   */
  public keys(path: FieldPath): FieldName[] {
    const map: Fields<TValue> | undefined = getIn(this.fields, path);
    if(!map) return [];

    return Object.getOwnPropertyNames(map).filter(key => key !== selfRef);
  }

  public set(path: FieldPath, value: TValue): void {
    path = [...path, selfRef];
    setIn(this.fields, path, value, () => ({}));
  }

  public has(path: FieldPath): boolean {
    return this.get(path) !== undefined;
  }

  public delete(path: FieldPath): void {
    const reference: Fields<TValue> | undefined = getIn(this.fields, path.slice(0, -1));
    if(reference !== undefined) {
      delete reference[path[path.length - 1]];
    }
  }
}
