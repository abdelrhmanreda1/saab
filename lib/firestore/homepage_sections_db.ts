import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  defaultHomepageSections,
  HomepageSection,
  mergeHomepageSectionsWithDefaults,
} from './homepage_sections';

const homepageSectionsCollection = collection(db, 'homepage_sections');

export const getHomepageSections = async (): Promise<HomepageSection[]> => {
  try {
    const q = query(homepageSectionsCollection, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    const sections = querySnapshot.docs.map(
      (snapshot) =>
        ({
          id: snapshot.id,
          ...snapshot.data(),
        }) as HomepageSection
    );

    return mergeHomepageSectionsWithDefaults(sections).sort((a, b) => a.order - b.order);
  } catch {
    return defaultHomepageSections;
  }
};

export const updateHomepageSections = async (sections: HomepageSection[]): Promise<void> => {
  const mergedSections = mergeHomepageSectionsWithDefaults(sections);

  await Promise.all(
    mergedSections.map((section) =>
      setDoc(
        doc(db, 'homepage_sections', section.id),
        {
          label: section.label,
          description: section.description,
          title: section.title ?? null,
          subtitle: section.subtitle ?? null,
          enabled: section.enabled,
          order: section.order,
          itemLimit: section.itemLimit ?? null,
        },
        { merge: true }
      )
    )
  );
};

export const seedHomepageSections = async (): Promise<void> => {
  await updateHomepageSections(defaultHomepageSections);
};
