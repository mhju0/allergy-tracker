import { Alert, type AlertButton } from 'react-native';
import { keepKoreanWordsTogether } from './lineBreaks';

// Every app alert goes through here so Korean copy wraps between words.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (message === undefined && buttons === undefined) {
    Alert.alert(keepKoreanWordsTogether(title));
    return;
  }
  Alert.alert(
    keepKoreanWordsTogether(title),
    message === undefined ? undefined : keepKoreanWordsTogether(message),
    buttons?.map((button) => (button.text === undefined ? button : { ...button, text: keepKoreanWordsTogether(button.text) })),
  );
}
