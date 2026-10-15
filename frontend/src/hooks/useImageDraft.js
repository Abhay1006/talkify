import { useCallback } from "react";
import { useToast } from "../context/ToastContext";
import useConversation from "../zustand/useConversations";
import { prepareImage, ImagePrepError, ACCEPTED_IMAGE_TYPES } from "../utils/prepareImage";

// Increments on every pick, so a slow prepare of an earlier image can never
// overwrite a later one.
let latestPick = 0;

const useImageDraft = () => {
  const { toast } = useToast();
  const imageDraft = useConversation((s) => s.imageDraft);
  const setImageDraft = useConversation((s) => s.setImageDraft);

  const pickImage = useCallback(
    async (file) => {
      if (!file) return;
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast("Only JPEG, PNG, WebP and GIF images are supported", "warning");
        return;
      }

      const pick = ++latestPick;
      setImageDraft({ status: "preparing" });

      try {
        const { blob, width, height } = await prepareImage(file);
        if (pick !== latestPick) return;
        setImageDraft({ status: "ready", blob, width, height, previewUrl: URL.createObjectURL(blob) });
      } catch (error) {
        if (pick !== latestPick) return;
        setImageDraft(null);
        toast(error instanceof ImagePrepError ? error.message : "That image couldn't be used", "error");
      }
    },
    [toast, setImageDraft]
  );

  const clearImage = useCallback(() => {
    latestPick++;
    setImageDraft(null);
  }, [setImageDraft]);

  return { imageDraft, pickImage, clearImage };
};

export default useImageDraft;
