import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const GRAVITY = 0.8;
const JUMP_FORCE = -12;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200;
const BIRD_SIZE = 30;
const PIPE_SPEED = 3;

interface Pipe {
  id: number;
  x: number;
  height: number;
}

type GameState = 'ready' | 'playing' | 'gameOver';

export function FlappyBirdGame() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gameHeight = screenHeight - insets.top - insets.bottom;

  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Bird animation values
  const birdY = useRef(new Animated.Value(gameHeight / 2)).current;
  const birdVelocity = useRef(0);
  const birdRotation = useRef(new Animated.Value(0)).current;

  // Game refs
  const gameLoopRef = useRef<NodeJS.Timeout>();
  const pipesRef = useRef<Pipe[]>([]);
  const nextPipeIdRef = useRef(0);
  const lastPipeXRef = useRef(screenWidth);

  // Reset game state
  const resetGame = useCallback(() => {
    birdY.setValue(gameHeight / 2);
    birdVelocity.current = 0;
    birdRotation.setValue(0);
    pipesRef.current = [];
    nextPipeIdRef.current = 0;
    lastPipeXRef.current = screenWidth;
    setScore(0);
    setGameState('ready');
  }, [gameHeight, screenWidth, birdY, birdRotation]);

  // Start game
  const startGame = useCallback(() => {
    setGameState('playing');
    resetGame();
    setGameState('playing');

    // Add first pipe
    pipesRef.current = [{
      id: nextPipeIdRef.current++,
      x: screenWidth + 100,
      height: Math.random() * (gameHeight - PIPE_GAP - 200) + 100,
    }];
    lastPipeXRef.current = screenWidth + 100;
  }, [resetGame, screenWidth, gameHeight]);

  // Jump function
  const jump = useCallback(() => {
    if (gameState === 'ready') {
      startGame();
      return;
    }

    if (gameState !== 'playing') return;

    birdVelocity.current = JUMP_FORCE;

    // Rotation animation for jump
    Animated.sequence([
      Animated.timing(birdRotation, {
        toValue: -30,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(birdRotation, {
        toValue: 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic feedback
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [gameState, startGame, birdRotation]);

  // Collision detection
  const checkCollisions = useCallback((currentBirdY: number) => {
    // Ground and ceiling collision
    if (currentBirdY <= 0 || currentBirdY >= gameHeight - BIRD_SIZE) {
      return true;
    }

    // Pipe collision
    const birdLeft = screenWidth / 2 - BIRD_SIZE / 2;
    const birdRight = screenWidth / 2 + BIRD_SIZE / 2;
    const birdTop = currentBirdY;
    const birdBottom = currentBirdY + BIRD_SIZE;

    for (const pipe of pipesRef.current) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;

      // Check if bird is in pipe's x range
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check collision with top or bottom pipe
        if (birdTop < pipe.height || birdBottom > pipe.height + PIPE_GAP) {
          return true;
        }
      }
    }

    return false;
  }, [gameHeight, screenWidth]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    gameLoopRef.current = setInterval(() => {
      // Update bird physics
      birdVelocity.current += GRAVITY;
      const currentBirdY = birdY._value + birdVelocity.current;
      birdY.setValue(currentBirdY);

      // Check collisions
      if (checkCollisions(currentBirdY)) {
        setGameState('gameOver');
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        return;
      }

      // Update pipes
      pipesRef.current = pipesRef.current.filter(pipe => {
        pipe.x -= PIPE_SPEED;

        // Check if bird passed pipe for scoring
        if (pipe.x + PIPE_WIDTH < screenWidth / 2 && pipe.x + PIPE_WIDTH + PIPE_SPEED >= screenWidth / 2) {
          setScore(prev => prev + 1);
          if (process.env.EXPO_OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }

        return pipe.x > -PIPE_WIDTH;
      });

      // Add new pipes
      if (lastPipeXRef.current < screenWidth - 250) {
        pipesRef.current.push({
          id: nextPipeIdRef.current++,
          x: screenWidth,
          height: Math.random() * (gameHeight - PIPE_GAP - 200) + 100,
        });
        lastPipeXRef.current = screenWidth;
      } else {
        const lastPipe = pipesRef.current[pipesRef.current.length - 1];
        if (lastPipe) {
          lastPipeXRef.current = lastPipe.x;
        }
      }
    }, 16); // ~60fps

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState, birdY, checkCollisions, gameHeight, screenWidth]);

  // Update high score
  useEffect(() => {
    if (gameState === 'gameOver' && score > highScore) {
      setHighScore(score);
    }
  }, [gameState, score, highScore]);

  return (
    <Pressable
      onPress={jump}
      style={{
        flex: 1,
        backgroundColor: '#87CEEB', // Sky blue
      }}
    >
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Game area */}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Bird */}
          <Animated.View
            style={{
              position: 'absolute',
              left: screenWidth / 2 - BIRD_SIZE / 2,
              width: BIRD_SIZE,
              height: BIRD_SIZE,
              backgroundColor: '#FFD700', // Gold
              borderRadius: BIRD_SIZE / 2,
              borderWidth: 2,
              borderColor: '#FFA500', // Orange
              transform: [
                { translateY: birdY },
                { rotate: birdRotation.interpolate({
                    inputRange: [-30, 30],
                    outputRange: ['-30deg', '30deg'],
                    extrapolate: 'clamp',
                  })
                }
              ],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            {/* Bird eye */}
            <View style={{
              position: 'absolute',
              right: 8,
              top: 8,
              width: 6,
              height: 6,
              backgroundColor: '#000',
              borderRadius: 3,
            }} />
          </Animated.View>

          {/* Pipes */}
          {pipesRef.current.map((pipe) => (
            <React.Fragment key={pipe.id}>
              {/* Top pipe */}
              <View
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: pipe.height,
                  backgroundColor: '#228B22', // Forest green
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: '#32CD32', // Lime green
                }}
              />
              {/* Bottom pipe */}
              <View
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  bottom: 0,
                  width: PIPE_WIDTH,
                  height: gameHeight - pipe.height - PIPE_GAP,
                  backgroundColor: '#228B22', // Forest green
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: '#32CD32', // Lime green
                }}
              />
            </React.Fragment>
          ))}

          {/* Ground */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 20,
            backgroundColor: '#8B4513', // Saddle brown
          }} />

          {/* Score */}
          <View style={{
            position: 'absolute',
            top: 50,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: '#FFF',
              textShadowColor: '#000',
              textShadowOffset: { width: 2, height: 2 },
              textShadowRadius: 4,
            }}>
              {score}
            </Text>
          </View>

          {/* Game state overlays */}
          {gameState === 'ready' && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}>
              <Text style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: '#FFF',
                textAlign: 'center',
                marginBottom: 20,
                textShadowColor: '#000',
                textShadowOffset: { width: 2, height: 2 },
                textShadowRadius: 4,
              }}>
                Flappy Bird
              </Text>
              <Text style={{
                fontSize: 18,
                color: '#FFF',
                textAlign: 'center',
                textShadowColor: '#000',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}>
                Tap to start!
              </Text>
              {highScore > 0 && (
                <Text style={{
                  fontSize: 16,
                  color: '#FFD700',
                  textAlign: 'center',
                  marginTop: 10,
                  textShadowColor: '#000',
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 2,
                }}>
                  High Score: {highScore}
                </Text>
              )}
            </View>
          )}

          {gameState === 'gameOver' && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}>
              <Text style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: '#FF6B6B',
                textAlign: 'center',
                marginBottom: 20,
                textShadowColor: '#000',
                textShadowOffset: { width: 2, height: 2 },
                textShadowRadius: 4,
              }}>
                Game Over!
              </Text>
              <Text style={{
                fontSize: 24,
                color: '#FFF',
                textAlign: 'center',
                marginBottom: 10,
                textShadowColor: '#000',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}>
                Score: {score}
              </Text>
              {score === highScore && score > 0 && (
                <Text style={{
                  fontSize: 18,
                  color: '#FFD700',
                  textAlign: 'center',
                  marginBottom: 20,
                  textShadowColor: '#000',
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 2,
                }}>
                  🎉 New High Score! 🎉
                </Text>
              )}
              <Text style={{
                fontSize: 18,
                color: '#FFF',
                textAlign: 'center',
                textShadowColor: '#000',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}>
                Tap to play again!
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}