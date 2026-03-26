/**
 * Test configuration for integration tests
 */
export const TEST_CONFIG = {
    mockServer: { 
        loginPort: 22106, 
        gamePort: 27777, 
        host: '127.0.0.1' 
    },
    testAccount: { 
        username: 'test_user', 
        password: 'test_pass', 
        characterSlot: 0 
    },
    api: { 
        port: 13000, 
        apiKey: 'test_api_key' 
    },
    timeouts: { 
        connection: 10000, 
        response: 5000, 
        websocket: 3000 
    }
};

/**
 * Test data generators
 */
export function generateTestCharacter(name: string = 'TestCharacter') {
    return {
        objectId: 12345678,
        name,
        race: 0, // Human
        sex: 0, // Male
        classId: 0, // Fighter
        level: 80,
        exp: 1000000,
        str: 40,
        dex: 30,
        con: 43,
        int: 21,
        wit: 11,
        men: 25,
        maxHp: 2444,
        currentHp: 2000,
        maxMp: 1345,
        currentMp: 1000,
        maxCp: 1000,
        currentCp: 800,
        sp: 5000000,
        currentLoad: 100,
        maxLoad: 1000,
        x: 100000,
        y: 200000,
        z: -3500
    };
}

export function generateTestNpc(objectId: number, npcId: number) {
    return {
        objectId,
        npcId,
        isAttackable: 1,
        x: 100100,
        y: 200100,
        z: -3500,
        heading: 0,
        level: 80,
        name: `NPC_${npcId}`
    };
}

export function generateTestItems() {
    return [
        {
            objectId: 1001,
            itemId: 76, // Sword
            slot: 0,
            count: 1,
            itemType: 1,
            customType1: 0,
            isEquipped: 1,
            bodyPart: 7,
            enchantLevel: 3,
            customType2: 0,
            augmentationId: 0,
            mana: 0
        },
        {
            objectId: 1002,
            itemId: 57, // Adena
            slot: 1,
            count: 500000,
            itemType: 4,
            customType1: 0,
            isEquipped: 0,
            bodyPart: 0,
            enchantLevel: 0,
            customType2: 0,
            augmentationId: 0,
            mana: 0
        }
    ];
}
