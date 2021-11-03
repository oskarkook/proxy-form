import produce, { enablePatches, Patch, produceWithPatches } from 'immer';
import { createContext } from 'react';
import { FieldsMap, getIn, groupListeners, isPlainObject, mkDefault } from './helpers';
import { FieldName, FieldPath, FormListener, FormOptions, RegistrationUpdater, UnsubscribeFn } from './types';

export interface ContextValue<TForm> {
  register: (fieldPaths: FieldPath[], onUpdate: RegistrationUpdater<TForm>) => UnsubscribeFn;
  listen: (updateFn: FormListener<TForm>) => UnsubscribeFn;
  getForm: () => TForm;
  update: (updateFn: (form: TForm) => TForm | void, options?: {validate?: boolean, notify?: boolean}) => void;
  trigger: () => void;
  defaultOptions?: FormOptions;
};

export const FormContext = createContext<ContextValue<unknown>>({
  register: () => () => {},
  listen: () => () => {},
  getForm: () => undefined,
  update: () => {},
  trigger: () => {},
});

enablePatches();
export class ProviderContext<TForm> implements ContextValue<TForm> {
  private form: Readonly<TForm>;
  private changedFields: FieldsMap<boolean> = new FieldsMap();
  private registrations: FieldsMap<RegistrationUpdater<TForm>[]> = new FieldsMap();
  private pendingPatches: readonly Patch[] = [];
  private formListeners: readonly FormListener<TForm>[];
  public readonly defaultOptions?: FormOptions;

  constructor(
    defaultValues: TForm,
    listeners?: FormListener<TForm>[],
    options?: FormOptions,
  ) {
    this.form = Object.freeze(defaultValues);
    this.formListeners = Object.freeze(listeners || []);
    this.defaultOptions = Object.freeze(options);
  }

  register(fieldPaths: FieldPath[], onUpdate: (form: TForm) => void) {
    fieldPaths.forEach(fieldPath => {
      let fieldListeners = this.registrations.get(fieldPath);
      if(fieldListeners === undefined) {
        fieldListeners = [];
        this.registrations.set(fieldPath, fieldListeners);
      }

      if(Array.isArray(fieldListeners)) {
        fieldListeners.push(onUpdate);
      }
    });

    onUpdate(this.form);

    return () => {
      fieldPaths.forEach(fieldPath => {
        const fieldListeners = this.registrations.get(fieldPath);
        if(!Array.isArray(fieldListeners)) return;
        const idx = fieldListeners.indexOf(onUpdate);
        fieldListeners.splice(idx, 1);
      });
    };
  }

  listen(listener: FormListener<TForm>) {
    this.formListeners = produce(this.formListeners, (listeners) => {
      listeners.push(listener);
    });

    return () => {
      this.formListeners = produce(this.formListeners, (listeners) => {
        const idx = listeners.indexOf(listener);
        listeners.splice(idx, 1);
      });
    };
  }

  getForm() {
    return this.form;
  }

  update(updateFn: (form: TForm) => TForm | void, options?: {validate?: boolean, notify?: boolean}) {
    const initialUpdate = produceWithPatches(this.form, updateFn);

    if(mkDefault(true, options?.validate)) {
      // Update changed fields. Note we run this only on the initial update as we only track fields that were changed by user.
      initialUpdate[1].forEach(patch => {
        if(patch.op === 'add' || patch.op === 'replace') {
          this.changedFields.set(patch.path, true);
        } else if(patch.op === 'remove') {
          this.changedFields.delete(patch.path);
        }
      });
    }

    // Run all form listeners recursively until no updates left
    const accumulate = (form: TForm, prevPatches: Patch[], allPatches: Patch[]): [TForm, Patch[]] => {
      if(prevPatches.length === 0) return [form, allPatches];
      allPatches = allPatches.concat(prevPatches);

      const [newForm, newPatches] = produceWithPatches(form, (form) => {
        prevPatches.forEach(patch => {
          this.formListeners.forEach(listener => listener({
            form: form as TForm,
            patch,
            changed: (path) => this.changedFields.has(path),
          }));
        });
      });

      return accumulate(newForm as TForm, newPatches, allPatches);
    };
    const [newForm, patches] = accumulate(initialUpdate[0] as TForm, initialUpdate[1], []);

    // Update value
    this.form = newForm as TForm;

    // Notify all the registered components
    this.pendingPatches = [...this.pendingPatches, ...patches];
    if(mkDefault(true, options?.notify)) this.trigger();
  }

  trigger() {
    const paths = this.pendingPatches.map(patch => {
      const referencePath = patch.path.slice(0, -1);
      const reference: any = getIn(this.form, referencePath);
      
      const value = reference[patch.path[patch.path.length - 1]];
      if(Array.isArray(reference) || Array.isArray(value) || isPlainObject(value)) {
        return referencePath;
      }

      return patch.path;
    });

    const listeners = groupListeners(this.registrations, paths);

    listeners.forEach(listener => {
      listener(this.form);
    });

    this.pendingPatches = [];
  }
}