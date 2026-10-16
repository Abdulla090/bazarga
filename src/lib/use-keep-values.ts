"use client";
import { startTransition, useCallback, type FormEvent } from "react";

/**
 * React 19 resets a `<form action={fn}>` after every submission, including one the server rejected, so a wrong
 * password, a taken email or one invalid price wiped everything the user had typed (4-language product copy too).
 * Pass the result as `onSubmit` next to the same `action`: with JS the action is dispatched without the reset;
 * without JS (before hydration) the plain `action` still posts the form. Forms that should clear after a successful
 * create reset themselves on `state.ok`.
 */
export function useKeepValues(formAction: (fd: FormData) => void) {
  return useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter;
      const fd = submitter ? new FormData(e.currentTarget, submitter) : new FormData(e.currentTarget);
      startTransition(() => formAction(fd));
    },
    [formAction],
  );
}
