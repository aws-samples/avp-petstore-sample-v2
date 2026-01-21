import './App.css';
import { Tabs, Text, Card, ThemeProvider, Flex, Authenticator, View } from '@aws-amplify/ui-react';
// REMOVED: import { Franchises, Stores, Products } from './pages';
import '@aws-amplify/ui-react/styles.css';

// ADDED: Define placeholder components because they don't exist in the source code.
const Placeholder = ({ name }) => <Card><Text>{name} content will be displayed here.</Text></Card>;
const Franchises = () => <Placeholder name="Franchises" />;
const Stores = () => <Placeholder name="Stores" />;
const Products = () => <Placeholder name="Products" />;

function App() {
  return (
    <ThemeProvider>
      <Authenticator>
        {({ signOut, user }) => (
          <View>
            <Card>
              <Flex direction="row" justifyContent="space-between">
                <Text fontSize="2em">PetStore</Text>
                <Text fontSize="1em" alignSelf="center">
                  Welcome, {user.username}! <a href="/" onClick={signOut} style={{ color: 'blue' }}>Sign out</a>
                </Text>
              </Flex>
            </Card>
            <Tabs justifyContent="flex-start">
              <Tabs.Item title="Franchises">
                <Franchises />
              </Tabs.Item>
              <Tabs.Item title="Stores">
                <Stores />
              </Tabs.Item>
              <Tabs.Item title="Products">
                <Products />
              </Tabs.Item>
            </Tabs>
          </View>
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

export default App;