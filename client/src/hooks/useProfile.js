import { useState } from "react";
import { loadProfile, saveProfile } from "../game/profile.js";

// Your profile ({ name, avatarSeed } or null), kept in this browser.
export function useProfile() {
  const [profile, setProfileState] = useState(loadProfile);

  function setProfile(next) {
    setProfileState(saveProfile(next));
  }

  return { profile, setProfile };
}
