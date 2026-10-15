import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import useConversation from '../zustand/useConversations';
import { apiClient } from '../api/client';
import { preloadMessageImage } from '../utils/messageImage';

const fileExtension = (type) => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' })[type] ?? 'img';

const useSendImage = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { addPendingImage, updatePendingImage, removePendingImage, appendMessage } = useConversation();

  const upload = useCallback(async (pending) => {
    const { tempId, receiverId, blob, caption } = pending;
    updatePendingImage(tempId, { status: 'uploading', progress: 0, error: null });

    const form = new FormData();
    form.append('image', blob, `image.${fileExtension(blob.type)}`);
    if (caption) form.append('caption', caption);

    try {
      const message = await apiClient.upload(`/api/messages/send/${receiverId}/image`, form, {
        onProgress: (progress) => updatePendingImage(tempId, { progress }),
      });
      // Keep the local preview on screen until the real image is ready, so the
      // bubble doesn't flash empty when one replaces the other.
      await preloadMessageImage(message.image);
      removePendingImage(tempId);
      // The user may have switched chats while this uploaded.
      if (useConversation.getState().selectedConversation?._id === receiverId) {
        appendMessage(message);
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      updatePendingImage(tempId, { status: 'failed', error: error.message });
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  }, [updatePendingImage, removePendingImage, appendMessage, queryClient, enqueueSnackbar]);

  // `draft` is a ready image draft; its preview URL now belongs to the pending
  // bubble and is revoked when that bubble goes away.
  const sendImage = useCallback((receiverId, draft, caption) => {
    const pending = {
      tempId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      receiverId,
      blob: draft.blob,
      previewUrl: draft.previewUrl,
      width: draft.width,
      height: draft.height,
      caption,
      progress: 0,
      status: 'uploading',
      error: null,
    };
    addPendingImage(pending);
    upload(pending);
  }, [addPendingImage, upload]);

  const retry = useCallback((pending) => upload(pending), [upload]);

  return { sendImage, retry, discard: removePendingImage };
};

export default useSendImage;
