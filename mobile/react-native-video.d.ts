declare module 'react-native-video' {
  import { Component } from 'react'
  import { StyleProp, ViewStyle } from 'react-native'

  type Props = {
    source: { uri: string }
    controls?: boolean
    paused?: boolean
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'none'
    style?: StyleProp<ViewStyle>
    onError?: (event: unknown) => void
  }

  export default class Video extends Component<Props> {}
}
