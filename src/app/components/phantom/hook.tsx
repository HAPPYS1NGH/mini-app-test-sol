'use client';

import { useContext } from "react";
import { PhantomContext } from "./context";

export function usePhantom() {
    return useContext(PhantomContext);
}