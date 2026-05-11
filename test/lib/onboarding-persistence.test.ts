/**
 * saveOnboardingData is the seam between the onboarding flow and
 * persistence — it decides which answers to write, flips the
 * onboarding-complete flag, and arms the tutorial. Mock the store
 * + DB so we can assert on those side effects independently.
 */

jest.mock('@/lib/store', () => ({
  useAppStore: { getState: jest.fn() },
}));
jest.mock('@/lib/db/settings', () => ({
  setSetting: jest.fn(),
}));

import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';
import { saveOnboardingData } from '@/lib/onboarding-persistence';

const setSettingMock = setSetting as jest.MockedFunction<typeof setSetting>;
const getStateMock = useAppStore.getState as jest.MockedFunction<typeof useAppStore.getState>;

function makeRouter() {
  return { replace: jest.fn() } as any;
}

function storeWith(tutorialCompleted: boolean) {
  return {
    setOnboardingComplete: jest.fn(),
    setTutorialPending: jest.fn(),
    tutorialCompleted,
  };
}

beforeEach(() => {
  setSettingMock.mockReset();
  getStateMock.mockReset();
});

describe('saveOnboardingData', () => {
  it('persists pain points as a JSON array when non-empty', async () => {
    const store = storeWith(false);
    getStateMock.mockReturnValue(store as any);
    const router = makeRouter();
    await saveOnboardingData({
      painPoints: ['scroll', 'rushing'],
      screenTime: ['4–5h'],
      router,
    });
    expect(setSettingMock).toHaveBeenCalledWith(
      'onboarding_painPoints',
      JSON.stringify(['scroll', 'rushing']),
    );
    expect(setSettingMock).toHaveBeenCalledWith('onboarding_screenTime', '4–5h');
  });

  it('skips painPoints write when none were selected', async () => {
    getStateMock.mockReturnValue(storeWith(false) as any);
    await saveOnboardingData({
      painPoints: [],
      screenTime: ['2–3h'],
      router: makeRouter(),
    });
    expect(setSettingMock).not.toHaveBeenCalledWith(
      'onboarding_painPoints',
      expect.anything(),
    );
    expect(setSettingMock).toHaveBeenCalledWith('onboarding_screenTime', '2–3h');
  });

  it('skips screenTime write when none was selected', async () => {
    getStateMock.mockReturnValue(storeWith(false) as any);
    await saveOnboardingData({
      painPoints: ['focus'],
      screenTime: [],
      router: makeRouter(),
    });
    expect(setSettingMock).not.toHaveBeenCalledWith(
      'onboarding_screenTime',
      expect.anything(),
    );
  });

  it('marks the onboarding flag and arms the tutorial when not yet completed', async () => {
    const store = storeWith(false);
    getStateMock.mockReturnValue(store as any);
    await saveOnboardingData({
      painPoints: [],
      screenTime: [],
      router: makeRouter(),
    });
    expect(store.setOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(store.setTutorialPending).toHaveBeenCalledWith(true);
  });

  it('skips arming the tutorial when it was already completed', async () => {
    const store = storeWith(true);
    getStateMock.mockReturnValue(store as any);
    await saveOnboardingData({
      painPoints: [],
      screenTime: [],
      router: makeRouter(),
    });
    expect(store.setOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(store.setTutorialPending).not.toHaveBeenCalled();
  });

  it('navigates to the home route on success', async () => {
    getStateMock.mockReturnValue(storeWith(false) as any);
    const router = makeRouter();
    await saveOnboardingData({
      painPoints: [],
      screenTime: [],
      router,
    });
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
