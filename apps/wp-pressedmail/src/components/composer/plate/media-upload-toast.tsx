'use client';

import * as React from 'react';
import { PlaceholderPlugin, UploadErrorCode } from '@kit/plate/media/react';
import { usePluginOption } from '@kit/plate/react';
import { __, sprintf } from '@wordpress/i18n';

import { appMessage } from '@/context/toast';

/** Surfaces media-upload validation errors (template port, PressedMail toast). */
export function MediaUploadToast() {
  useUploadErrorToast();

  return null;
}

const useUploadErrorToast = () => {
  const uploadError = usePluginOption(PlaceholderPlugin, 'error');

  React.useEffect(() => {
    if (!uploadError) return;

    const { code, data } = uploadError;

    switch (code) {
      case UploadErrorCode.INVALID_FILE_SIZE:
      case UploadErrorCode.INVALID_FILE_TYPE: {
        appMessage(
          sprintf(
            /* translators: %s: file names */
            __('These files cannot be uploaded: %s', 'pressedmail'),
            data.files.map((f) => f.name).join(', '),
          ),
          'error',
        );
        break;
      }
      case UploadErrorCode.TOO_LARGE: {
        appMessage(
          sprintf(
            /* translators: 1: file names, 2: max size */
            __('Files %1$s exceed the maximum size of %2$s', 'pressedmail'),
            data.files.map((f) => f.name).join(', '),
            String(data.maxFileSize),
          ),
          'error',
        );
        break;
      }
      case UploadErrorCode.TOO_LESS_FILES: {
        appMessage(
          sprintf(
            /* translators: 1: count, 2: file type */
            __('At least %1$s files are required for %2$s', 'pressedmail'),
            String(data.minFileCount),
            String(data.fileType),
          ),
          'error',
        );
        break;
      }
      case UploadErrorCode.TOO_MANY_FILES: {
        appMessage(
          sprintf(
            /* translators: 1: count, 2: file type */
            __('The maximum number of files is %1$s %2$s', 'pressedmail'),
            String(data.maxFileCount),
            data.fileType ? `for ${data.fileType}` : '',
          ),
          'error',
        );
        break;
      }
    }
  }, [uploadError]);
};
