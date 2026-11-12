import { Composition, registerRoot } from '@kinetographdev/core';
import { Title } from './scenes/Title';
registerRoot(() => <Composition id="Main" component={Title} durationInFrames={900} fps={30} width={1280} height={720} />);
