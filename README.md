# Proxy Form
Proxy Form is a library that uses JavaScript's
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to make it easy to
work with your form state in React. In practice, this means that you can build forms by simply treating your state as a
regular object:

```tsx
import React from 'react';
import { useForm } from 'proxy-form';

interface MyForm {
  name: string;
  someValue: string;
  extraField: string;
  specialField: number[];
};
export const MyFormComponent: React.FC<{}> = () => {
  const { form, field, update } = useForm<MyForm>();
  return (
    <div>
      <input type='text' {...field(form.name)} />
      <input type='text' {...field(form.someValue)} />
      <input type='text' {...field(form.extraField)} />

      <div onClick={() => update(form => { form.specialField.push(Math.random() * 100) })}>
        Random numbers: ${form.specialField.map(n => Math.floor(n))}
      </div>
    </div>
  );
}
```

## Dependency tracking
As seen in the example, we do not set up explicit dependencies on fields, as you would do with other libraries. Instead,
field dependencies are tracked automatically during rendering. Any fields that you use at render time will be tracked
and when the given field changes, the component is re-rendered automatically. This applies to arrays and nested objects
as well.

## Form updates
Updates to the form can be done by calling the `update()` function that is returned from the `useForm()` hook. Updates
are handled through [Immer](https://immerjs.github.io/immer/), so all the documentation from Immer applies to the
update function. In short, you edit your form as you would any other JavaScript object, all the changes are tracked
by Immer and synthesized into a new object:

```ts
update(form => {
  form.name = 'new name';
  form.someValue = 'new value';
  form.specialField.push(2);
});
```

### Global form listeners
Form listeners listen to any updates on a form. When an update is performed, the listeners are called and they can
perform their own changes on the form. This allows for a way to do central updates, e.g. for fields that depend on
each-other.

For example, to centrally uppercase the `name` field in the form:
```tsx
import React from 'react';
import { FormProvider } from 'proxy-form';

interface MyForm {
  name: string;
  someValue: string;
}
export const MyFormComponent: React.FC<{}> = () => {
  const defaultValues: MyForm = {
    name: 'my name',
    someValue: 'some value',
  };

  return (
    <FormProvider defaultValues={defaultValues} listeners={[
      ({ form, patch }) => {
        if(patch.path[0] === 'name') {
          form.name = form.name.toUpperCase();
        }
      }
    ]}>
      <MyComponent/>
    </FormProvider>
  );
}
```

The `patch` variable here is a JSON patch provided by Immer. [The documentation for Immer's patch feature can be found
here.](https://immerjs.github.io/immer/patches/)

## Usage
```sh
yarn add proxy-form
```

The main API points are:
- `<FormProvider/>` component, which stores the form state and exposes it as a React context
- `useForm()` hook, which provides helpers to access the form state
- `<UseForm/>` component, which is a wrapper around the `useForm()` hook. [This component is mainly used to encapsulate
rendered fields to avoid re-rendering large React components](#controlled-fields)
- `useFormContext()` hook, which provides raw access to the form context. This can be useful in some edge cases

### Example use
`types.ts`
```ts
export interface MyForm {
  name: string;
  someValue: string;
}
```

`MyFormWrapper.tsx`
```tsx
import React from 'react';
import { FormProvider } from 'proxy-form';
import { MyForm } from './types';
import { MyFormInputs } from './MyFormInputs';

export const MyFormWrapper: React.FC<{}> = () => {
  return (
    <FormProvider<MyForm> defaultValues={{
      name: '',
      someValue: '',
    }}>
      <MyFormInputs/>
    </FormProvider>
  );
}
```

`MyFormInputs.tsx`
```tsx
import React from 'react';
import { useForm } from 'proxy-form';
import { MyForm } from './types';

export const MyFormInputs: React.FC<{}> = () => {
  const { form, field } = useForm<MyForm>();
  return (
    <div>
      <input type='text' {...field(form.name)}>
      <input type='text' {...field(form.someValue)}>
    </div>
  );
}
```

### Caution with `field()`!
When using `field()`, you should not access fields conditionally in the call, e.g. `field(form.value ||
form.otherValue)` or `field(form.obj?.value)`. In the first case, you should assign the correct value to the form state
itself, e.g. `field(form.valueOrOtherValue)`. In the second case, you should do the existency check outside the
`field()` call:

```tsx
export const MyComponent: React.FC<{}> = () => {
  const { form, field } = useForm<MyForm>();
  return (
    <div>
      {form.obj && (
        <input type='text' {...field(form.obj.value)}>
      )}
      {/* Alternatively: */}
      <input type='text' {...(form.obj ? field(form.obj.value) : {} )}>
    </div>
  );
}
```

Additionally, do not mix `form` and `field()` variables between components:
```tsx
export const MyComponent: React.FC<{}> = () => {
  const { form, field } = useForm<MyForm>();

  return (
    <div>
      {/* Bad: mixing the `field()` function from parent with `form` from child */}
      <UseForm<MyForm> render={({ form }) => (
        <input type='text' {...field(form.name)}>
      )}>
      {/* Bad: mixing the `form` variable from parent with the `field()` function from child */}
      <UseForm<MyForm> render={({ field }) => (
        <input type='text' {...field(form.someValue)}>
      )}>
    </div>
  )
}
```

Many of these are caught automatically, but you should be mindful of it.

## API
**TODO**

## Performance tips
Performance in React mainly comes down to avoiding renders of large component trees. You want to focus updates and
re-renders to only the fields that actually change. There's two ways to do this.

### Uncontrolled forms or fields
The simplest solution to performance issues is to render the form or the fields in an uncontrolled manner. This means
that changes from the input are propagated to the form state, but dependencies are not actually tracked. [See also:
official React documentation](https://reactjs.org/docs/uncontrolled-components.html).

To set the form to render in an uncontrolled manner by default:
```tsx
import React from 'react';
import { FormProvider } from 'proxy-form';

export const MyApp: React.FC<{}> = () => (
  <FormProvider defaultValues={{}} defaultOptions={{ controlled: false }}>
    <MyComponent/>
  </FormProvider>
);
```

If you do not want to set the whole form to render uncontrolled by default, you can alternatively just render the all
the fields in a single component in an uncontrolled manner:
```tsx
import React from 'react';
import { useForm } from 'proxy-form';

export const MyComponent: React.FC<{}> = () => {
  const { field, form } = useForm<MyForm>({ controlled: false });

  return (
    <div>
      <input type='text' {...field(form.name)}>
    </div>
  );
}
```

If you do not want to set the whole component to render in an uncontrolled manner, you can render a single field as
uncontrolled:
```tsx
import React from 'react';
import { useForm } from 'proxy-form';

export const MyComponent: React.FC<{}> = () => {
  const { field, form } = useForm<MyForm>();

  return (
    <div>
      <input type='text' {...field(form.name, { controlled: false })}>
    </div>
  )
}
```

You can mix and match these uses to your preference. A higher-specificity option overrides a lower-specificity one
(`field() > useForm() > FormProvider`)

### Controlled fields
If uncontrolled fields do not suit your use-case, the main performance gain in a controlled form is to scope the fields
to their own component. You can either create your own custom components for this, or you can wrap the field in a
`<UseForm/>` component:

```tsx
import React from 'react';
import { UseForm } from 'proxy-form';

export const MyComponent: React.FC<{}> = () => {
  return (
    <div>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.name)}>
      )}>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.someValue)}>
      )}>
      <UseForm<MyForm> render={({ field, form }) => (
        <input type='text' {...field(form.extraField)}>
      )}>
    </div>
  );
}
```

This does introduce some extra fluff into your render tree, but it is an issue that inherently stems from the way
React's rendering engine works and can't be avoided.

## FAQ
### Why?
The other popular form libraries I've tried have a lot of ceremony or they are plainly not performant. I also need to
run custom functions that update a large number of fields that depend on eachother. Here are my issues with the
libraries I've tried:
- [Formik](https://formik.org/)
  - Unperformant with large forms. Making it performant is practically impossible.
- [react-hook-form](https://react-hook-form.com/)
  - A lot of ceremony and custom logic
  - Need to track fields yourself
  - Array updates are difficult to deal with
  - Performance with arrays can be difficult to optimize
  - Updating the form externally can become difficult if you have many inter-dependent fields

### Why `update()` instead of using the `set()` handler of the Proxy?
The `set()` handler theoretically could offer an even more convenient usage of the state object, as you could directly
manipulate the form data. These are the reasons why the `update()` handler is prefered:
- We use Immer, which simplifies life a lot. Immer has this usage pattern, so we use it, too.
- `update()` makes it easier to do multiple updates in one go. Imagine you have an array where all the elements need to
be changed for some reason. With `set()`, you would end up triggering many changes and re-renders, whereas with
`update()` it ends up being a single change.
- It makes updates explicit. You can't accidentally set some value, but instead you have to essentially declare your
updates, which makes it easier to reason about the data flow.

## Useful information
### Form update cycle
Form updates have a 3-part cycle:
1. The update is performed on the form
2. The form listeners run in a loop until no single listener performs an update (this is necessary since fields can have cascading dependencies)
3. All the registered fields are notified of the changes