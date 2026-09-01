'use client';

import * as React from 'react';
import { __ } from '@wordpress/i18n';

import { uploadImage, validateImage } from '@/services/image-upload.service';
import { appMessage } from '@/context/toast';

export interface ComposerUploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
}

/**
 * Template use-upload-file.ts interface implemented over the PressedMail
 * WordPress upload endpoint (attachments/upload-image). The REST call has no
 * progress events, so progress is simulated 0→90 while the request runs and
 * jumps to 100 on resolve. Only images are supported. The email backend has
 * no generic media storage; other types surface an error and the caller
 * removes the placeholder.
 */
export function useComposerUploadFile() {
  const [uploadedFile, setUploadedFile] = React.useState<ComposerUploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const uploadFile = React.useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadingFile(file);
    setUploadError(null);
    setProgress(0);

    if (!file.type.startsWith('image/')) {
      const message = __(
        'Only image uploads are supported in the composer. Insert other media via URL instead.',
        'pressedmail',
      );
      appMessage(message, 'error');
      setUploadError(message);
      setIsUploading(false);
      setUploadingFile(undefined);
      return;
    }

    const validation = validateImage(file);
    if (!validation.valid) {
      const message =
        validation.error ?? __('Invalid image file.', 'pressedmail');
      appMessage(message, 'error');
      setUploadError(message);
      setIsUploading(false);
      setUploadingFile(undefined);
      return;
    }

    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + 6, 90));
    }, 150);

    try {
      const url = await uploadImage(file);
      setProgress(100);
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : __('Upload failed, please try again.', 'pressedmail');
      appMessage(message, 'error');
      setUploadError(message);
    } finally {
      clearInterval(timer);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }, []);

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadError,
    uploadFile,
    uploadingFile,
  };
}
