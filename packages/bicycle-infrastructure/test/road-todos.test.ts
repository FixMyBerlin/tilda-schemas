/**
 * Conformance for the todos of a road (`road_todo_categories.lua`), driven by
 * schemas/bicycle-infrastructure-attributes/fixtures/road-todos.
 */
import { describe, expect, test } from 'bun:test'
import roadTodoFixtures from '../../../schemas/bicycle-infrastructure-attributes/fixtures/road-todos/road-todos.json'
import { ROAD_TODOS, deriveRoadTodos, processBikelanes, type OsmTags } from '../src/index.ts'

type RoadTodoCase = {
  name: string
  input: Record<string, string>
  result?: { selfBikelaneHasUnusualWidth?: boolean; width?: number | null }
  expect: { todos?: string[]; todos_include?: string[]; todos_exclude?: string[] }
}

describe('spec: road-todos', () => {
  for (const c of roadTodoFixtures as unknown as RoadTodoCase[]) {
    test(c.name, () => {
      const todos = deriveRoadTodos(c.input as OsmTags, c.result)
      if (c.expect.todos) expect(todos).toEqual(c.expect.todos)
      for (const id of c.expect.todos_include ?? []) expect(todos).toContain(id)
      for (const id of c.expect.todos_exclude ?? []) expect(todos).not.toContain(id)
    })
  }
})

describe('road todos', () => {
  test('are in the order of LUA, without the sidepath CSV todo', () => {
    expect(ROAD_TODOS.map((todo) => todo.id)).toEqual([
      'deprecated_cycleway_shared',
      'unusual_width',
    ])
  })

  test('unusual_width is table-only, deprecated_cycleway_shared is not', () => {
    expect(ROAD_TODOS.map((todo) => todo.todoTableOnly)).toEqual([false, true])
  })

  test('the width is read like the roads table does when no result is given', () => {
    expect(deriveRoadTodos({ highway: 'residential', width: '100 cm' })).toEqual([])
    expect(deriveRoadTodos({ highway: 'residential', width: '1-2' })).toEqual(['unusual_width'])
  })

  test('one unusual_width per way: the self row of a cycleway has it, the road does not repeat it', () => {
    const tags = { highway: 'cycleway', width: '0' } as OsmTags
    const self = processBikelanes(tags).find((row) => row._side === 'self')
    expect(self?.todos).toContain('unusual_width')
    expect(
      deriveRoadTodos(tags, {
        selfBikelaneHasUnusualWidth: self?.todos?.includes('unusual_width'),
      }),
    ).toEqual([])
  })

  test('a lane reads its own width, the road reads the road width', () => {
    const tags = {
      highway: 'residential',
      width: '6',
      'cycleway:right': 'lane',
      'cycleway:right:width': 'narrow',
    } as OsmTags
    expect(processBikelanes(tags).find((row) => row._side === 'right')?.todos).toContain(
      'unusual_width',
    )
    expect(deriveRoadTodos(tags)).toEqual([])
  })
})
