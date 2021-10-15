import produce, { Patch, produceWithPatches } from 'immer';
import React, { useMemo, useRef } from 'react';
import { ContextValue, FormContext } from './context';
import { callRegistrations, FieldsMap, getIn, isPlainObject, mkDefault } from './helpers';
import { FieldName, FormListener, FormOptions, RegistrationUpdater } from './types';

interface FormProviderProps<TForm> {
  defaultValues: TForm;
  defaultOptions?: FormOptions;
  listeners?: FormListener<TForm>[];
  children?: React.ReactNode;
};
export const FormProvider = <TForm extends Record<string, any>>({ defaultValues, defaultOptions, listeners = [], children }: FormProviderProps<TForm>): React.ReactElement => {
  const formRef = useRef(defaultValues);
  const options = useRef(defaultOptions);
  const changedFieldsRef  = useRef(new FieldsMap<{[key: FieldName]: any}>());
  const registrationsRef  = useRef(new FieldsMap<RegistrationUpdater<TForm>[]>());
  const pendingPatchesRef = useRef<Patch[]>([]);
  const formListenersRef  = useRef<FormListener<TForm>[]>(listeners);

  const context: ContextValue<TForm> = useMemo(() => ({
    defaultOptions: options.current,
    register(fieldPaths, onUpdate) {
      fieldPaths.forEach(fieldPath => {
        let fieldListeners = registrationsRef.current.get(fieldPath);
        if(fieldListeners === undefined) {
          fieldListeners = [];
          registrationsRef.current.set(fieldPath, fieldListeners);
        }

        if(Array.isArray(fieldListeners)) {
          fieldListeners.push(onUpdate);
        }
      });

      onUpdate(formRef.current);

      return () => {
        fieldPaths.forEach(fieldPath => {
          const fieldListeners = registrationsRef.current.get(fieldPath);
          if(!Array.isArray(fieldListeners)) return;
          const idx = fieldListeners.indexOf(onUpdate);
          fieldListeners.splice(idx, 1);
        });
      };
    },
    listen(listener) {
      formListenersRef.current = produce(formListenersRef.current, (listeners) => {
        listeners.push(listener);
      });

      return () => {
        formListenersRef.current = produce(formListenersRef.current, (listeners) => {
          const idx = listeners.indexOf(listener);
          listeners.splice(idx, 1);
        });
      };
    },
    getForm() {
      return formRef.current;
    },
    update(updateFn, options) {
      const initialUpdate = produceWithPatches(formRef.current, updateFn);

      if(mkDefault(true, options?.validate)) {
        // Update changed fields. Note we run this only on the initial update as we only track fields that were changed by user.
        initialUpdate[1].forEach(patch => {
          if(patch.op === 'add' || patch.op === 'replace') {
            changedFieldsRef.current.set(patch.path, {});
          } else if(patch.op === 'remove') {
            changedFieldsRef.current.delete(patch.path);
          }
        });
      }

      // Run all form listeners recursively until no updates left
      const accumulate = (form: TForm, prevPatches: Patch[], allPatches: Patch[]): [TForm, Patch[]] => {
        if(prevPatches.length === 0) return [form, allPatches];
        allPatches = allPatches.concat(prevPatches);

        const [newForm, newPatches] = produceWithPatches(form, (form) => {
          prevPatches.forEach(patch => {
            formListenersRef.current.forEach(listener => listener({
              form: form as TForm,
              patch,
              changed: (path) => changedFieldsRef.current.has(path),
            }));
          });
        });

        return accumulate(newForm as TForm, newPatches, allPatches);
      };
      const [newForm, patches] = accumulate(initialUpdate[0] as TForm, initialUpdate[1], []);

      // Update value
      formRef.current = newForm as TForm;

      // Notify all the registered components
      pendingPatchesRef.current = [...pendingPatchesRef.current, ...patches];
      if(mkDefault(true, options?.notify)) context.trigger();
    },
    trigger() {
      pendingPatchesRef.current.forEach(patch => {
        const referencePath = patch.path.slice(0, -1);
        const reference: any = getIn(formRef.current, referencePath);
        
        if(Array.isArray(reference)) {
          // Update listeners that might not get updated otherwise
          // TODO: this needs to be optimized
          Object.getOwnPropertyNames(Array.prototype).forEach(attr => {
            callRegistrations(registrationsRef.current, [...referencePath, attr], onUpdate => onUpdate(formRef.current));
          });
        }

        const value = reference[patch.path[patch.path.length - 1]];
        if(Array.isArray(value) || isPlainObject(value)) {
          callRegistrations(registrationsRef.current, referencePath, onUpdate => onUpdate(formRef.current));
        } else {
          callRegistrations(registrationsRef.current, patch.path, onUpdate => onUpdate(formRef.current));
        }
      });

      pendingPatchesRef.current = [];
    },
  }), []);

  return (
    <FormContext.Provider value={context as ContextValue<unknown>}>
      { children }
    </FormContext.Provider>
  );
}