const BACKGROUND_BY_GENDER = { male: "b6e3f4", female: "ffdfbf" };

export const defaultAvatarUrl = (username, gender) => {
  const seed = encodeURIComponent(username);
  const background = BACKGROUND_BY_GENDER[gender] ?? BACKGROUND_BY_GENDER.female;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=${background}`;
};
