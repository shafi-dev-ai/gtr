import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
  navigation?: any;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const handleGetStarted = () => {
    // Navigate to login/register screen
    navigation?.navigate('Login');
  };

  return (
    <ImageBackground
      source={require('../../../assets/images/welcome-bg.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          
          {/* <Text style={styles.descriptionText}>
            A place where enthusiasts can buy, sell, showcase builds, and connect with the community like never before.
          </Text> */}
        </View>

        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  textContainer: {
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 42,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  logo: {
    width: 239,
    height: 91,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 26,
    opacity: 0.9,
  },
  getStartedButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedText: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.5,
  },
});

