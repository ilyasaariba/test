"use client";

import { InputHTMLAttributes } from "react";

// A number <input> that selects its current value on focus, so a single click
// lets you type over the default (e.g. type "19" to replace "1"). The native
// up/down spinner is hidden globally in globals.css — use +/- buttons instead.
export default function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      onFocus={(e) => {
        e.currentTarget.select();
        props.onFocus?.(e);
      }}
    />
  );
}
