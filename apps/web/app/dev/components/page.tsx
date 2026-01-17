'use client';

import { useState, type ChangeEvent } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  Avatar,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Loader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
  ThemeSwitcher,
} from '@/components/ui';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ComponentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const toast = useToast();

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cette page est disponible uniquement en developpement.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Composants UI
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Bibliotheque de composants pour OPATAM
          </p>
        </header>

        {/* Theme Switcher */}
        <Section title="Theme">
          <ThemeSwitcher />
        </Section>

        {/* Buttons */}
        <Section title="Button">
          <SubSection title="Variantes">
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </SubSection>

          <SubSection title="Tailles">
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </SubSection>

          <SubSection title="Etats">
            <div className="flex flex-wrap gap-4">
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
              <Button fullWidth>Full Width</Button>
            </div>
          </SubSection>

          <SubSection title="Avec icones">
            <div className="flex flex-wrap gap-4">
              <Button
                leftIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Ajouter
              </Button>
              <Button
                variant="outline"
                rightIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                }
              >
                Suivant
              </Button>
            </div>
          </SubSection>
        </Section>

        {/* Inputs */}
        <Section title="Input">
          <div className="grid gap-6 sm:grid-cols-2">
            <Input label="Texte" placeholder="Entrez votre texte" />
            <Input label="Email" type="email" placeholder="email@exemple.com" />
            <Input label="Mot de passe" type="password" placeholder="********" />
            <Input label="Telephone" type="tel" placeholder="+33 6 12 34 56 78" />
            <Input label="Avec erreur" error="Ce champ est requis" defaultValue="Valeur invalide" />
            <Input label="Desactive" disabled placeholder="Non modifiable" />
            <Input label="Avec indication" hint="Minimum 8 caracteres" placeholder="Mot de passe" />
          </div>
        </Section>

        {/* Textarea */}
        <Section title="Textarea">
          <div className="grid gap-6 sm:grid-cols-2">
            <Textarea label="Description" placeholder="Decrivez votre activite..." />
            <Textarea label="Avec erreur" error="La description est trop courte" defaultValue="Texte" />
            <Textarea label="Desactive" disabled placeholder="Non modifiable" />
            <Textarea label="Avec indication" hint="Maximum 500 caracteres" />
          </div>
        </Section>

        {/* Select */}
        <Section title="Select">
          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Categorie"
              placeholder="Choisir une categorie"
              options={[
                { value: 'beauty', label: 'Beaute & Esthetique' },
                { value: 'wellness', label: 'Bien-etre & Sante' },
                { value: 'sport', label: 'Sport & Coaching' },
                { value: 'training', label: 'Formation & Cours' },
              ]}
            />
            <Select
              label="Avec erreur"
              error="Veuillez selectionner une option"
              options={[
                { value: 'a', label: 'Option A' },
                { value: 'b', label: 'Option B' },
              ]}
            />
            <Select
              label="Desactive"
              disabled
              options={[{ value: 'disabled', label: 'Non modifiable' }]}
            />
          </div>
        </Section>

        {/* Checkbox & Switch */}
        <Section title="Checkbox & Switch">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <SubSection title="Checkbox">
                <div className="space-y-3">
                  <Checkbox
                    label="Accepter les conditions"
                    checked={checkboxChecked}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCheckboxChecked(e.target.checked)}
                  />
                  <Checkbox
                    label="Avec description"
                    description="Une description supplementaire pour cette option"
                  />
                  <Checkbox label="Desactive" disabled />
                  <Checkbox label="Desactive et coche" disabled checked />
                </div>
              </SubSection>
            </div>

            <div className="space-y-4">
              <SubSection title="Switch">
                <div className="space-y-3">
                  <Switch
                    label="Notifications"
                    checked={switchChecked}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSwitchChecked(e.target.checked)}
                  />
                  <Switch
                    label="Avec description"
                    description="Recevoir des notifications par email"
                  />
                  <Switch label="Desactive" disabled />
                  <Switch label="Desactive et actif" disabled checked />
                </div>
              </SubSection>
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Card">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card variant="default">
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400">Variante default</p>
              </CardBody>
            </Card>

            <Card variant="bordered">
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400">Variante bordered</p>
              </CardBody>
            </Card>

            <Card variant="elevated">
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400">Variante elevated</p>
              </CardBody>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader
                title="Carte complete"
                description="Avec header, body et footer"
                action={<Button size="sm" variant="outline">Action</Button>}
              />
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400">
                  Contenu de la carte avec du texte et potentiellement d&apos;autres elements.
                </p>
              </CardBody>
              <CardFooter>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">Annuler</Button>
                  <Button size="sm">Confirmer</Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badge">
          <SubSection title="Variantes">
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </SubSection>

          <SubSection title="Tailles">
            <div className="flex flex-wrap items-center gap-3">
              <Badge size="sm">Small</Badge>
              <Badge size="md">Medium</Badge>
            </div>
          </SubSection>
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <SubSection title="Avec image">
            <div className="flex flex-wrap items-end gap-4">
              <Avatar src="https://i.pravatar.cc/150?img=1" alt="John Doe" size="sm" />
              <Avatar src="https://i.pravatar.cc/150?img=2" alt="Jane Smith" size="md" />
              <Avatar src="https://i.pravatar.cc/150?img=3" alt="Bob Johnson" size="lg" />
              <Avatar src="https://i.pravatar.cc/150?img=4" alt="Alice Williams" size="xl" />
            </div>
          </SubSection>

          <SubSection title="Fallback (initiales)">
            <div className="flex flex-wrap items-end gap-4">
              <Avatar alt="John Doe" size="sm" />
              <Avatar alt="Jane Smith" size="md" />
              <Avatar alt="Bob Johnson" size="lg" />
              <Avatar alt="Alice Williams" size="xl" />
            </div>
          </SubSection>
        </Section>

        {/* Modal */}
        <Section title="Modal">
          <Button onClick={() => setIsModalOpen(true)}>Ouvrir le modal</Button>

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <ModalHeader title="Titre du modal" onClose={() => setIsModalOpen(false)} />
            <ModalBody>
              <p className="text-gray-600 dark:text-gray-400">
                Ceci est le contenu du modal. Vous pouvez y mettre n&apos;importe quel contenu.
              </p>
              <div className="mt-4">
                <Input label="Un champ dans le modal" placeholder="Exemple..." />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>Confirmer</Button>
            </ModalFooter>
          </Modal>
        </Section>

        {/* Toast */}
        <Section title="Toast">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={() => toast.success('Operation reussie !')}>
              Success Toast
            </Button>
            <Button variant="outline" onClick={() => toast.error('Une erreur est survenue')}>
              Error Toast
            </Button>
            <Button variant="outline" onClick={() => toast.warning('Attention requise')}>
              Warning Toast
            </Button>
            <Button variant="outline" onClick={() => toast.info('Information importante')}>
              Info Toast
            </Button>
          </div>
        </Section>

        {/* Loader */}
        <Section title="Loader">
          <div className="flex flex-wrap items-center gap-8">
            <div className="text-center">
              <Loader size="sm" />
              <p className="mt-2 text-sm text-gray-500">Small</p>
            </div>
            <div className="text-center">
              <Loader size="md" />
              <p className="mt-2 text-sm text-gray-500">Medium</p>
            </div>
            <div className="text-center">
              <Loader size="lg" />
              <p className="mt-2 text-sm text-gray-500">Large</p>
            </div>
          </div>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Onglet 1</TabsTrigger>
              <TabsTrigger value="tab2">Onglet 2</TabsTrigger>
              <TabsTrigger value="tab3">Onglet 3</TabsTrigger>
              <TabsTrigger value="tab4" disabled>Desactive</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <Card>
                <CardBody>
                  <p className="text-gray-600 dark:text-gray-400">
                    Contenu du premier onglet. Vous pouvez y mettre n&apos;importe quel contenu.
                  </p>
                </CardBody>
              </Card>
            </TabsContent>
            <TabsContent value="tab2">
              <Card>
                <CardBody>
                  <p className="text-gray-600 dark:text-gray-400">
                    Contenu du deuxieme onglet avec un formulaire.
                  </p>
                  <div className="mt-4">
                    <Input label="Nom" placeholder="Votre nom..." />
                  </div>
                </CardBody>
              </Card>
            </TabsContent>
            <TabsContent value="tab3">
              <Card>
                <CardBody>
                  <p className="text-gray-600 dark:text-gray-400">
                    Contenu du troisieme onglet.
                  </p>
                </CardBody>
              </Card>
            </TabsContent>
          </Tabs>
        </Section>

      </div>
    </div>
  );
}
